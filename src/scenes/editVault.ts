import { Scenes } from 'telegraf';
import { BudgetBuddyContext } from '../types/session';
import {BudgetBuddyBotService} from "../service";
import {Currency, CURRENCY_CODES} from "current-currency/dist/types/currencies";

const SCENE_ID = 'editVault';

const CHOOSE_VAULT_STEP = 0;
const ACTION_STEP = 1;

const ACTION_CALLBACK_PREFIX = 'edit';

const TITLE_ACTION = 'title';
const CURRENCY_ACTION = 'currency';
const AMOUNT_ACTION = 'amount';
const ACTIVE_STATE_ACTION = 'active';

const ACTIVE_STATE_ACTION_CONFIRM = 'confirm';
const ACTIVE_STATE_ACTION_CANCEL = 'cancel';

export class EditVaultScene extends Scenes.BaseScene<BudgetBuddyContext> {
	private readonly service: BudgetBuddyBotService;

	private step: number = 0;
	private options: any[] = [];
	private currentVault: any;
	private currentAction: string = '';
	private currentActionParams: string[] = [];

	constructor(service: BudgetBuddyBotService) {
		super(SCENE_ID);
		this.service = service;

		this.enter(async(ctx) => {
			const chatId = ctx.chat?.id;
			if (!chatId) {
				return;
			}

			this.resetState();

			const vaults = await this.service.getUserVaults(chatId.toString());
			let vaultsText = ""
			vaults.forEach((vault, index) => {
				vaultsText += `${index + 1}. ${vault.title} (${vault.amount === undefined ? '?' : vault.amount} ${vault.currency})\n`;
				this.options.push(vault)
			});

			await ctx.reply(`Выберите счет:\n\n${vaultsText}`);
		})

		this.command('cancel', async (ctx) => {
			await ctx.reply('Отмена редактирования счета');
			await ctx.scene.leave();
		})

		const regexp = new RegExp(`${ACTION_CALLBACK_PREFIX}+`);
		this.action(regexp, async (ctx) => {
			const commands = ctx.match.input.split('_')

			this.currentAction = commands[1]
			if (!this.currentAction) {
				await ctx.scene.leave();
				return ctx.scene.enter('editVault');
			}

			if (commands.length === 2) {
				this.instructAction(ctx);
			}
			else
			{
				this.currentActionParams = commands.slice(2);
				if (await this.performAction(ctx))
				{
					await ctx.scene.leave();
				}
			}

			await ctx.answerCbQuery();
		});

		this.on('text', async (ctx) => {
			switch (this.step) {
				case CHOOSE_VAULT_STEP:
					await this.chooseVaultStep(ctx);
					break;
				case ACTION_STEP:
					if (await this.performAction(ctx))
					{
						await ctx.scene.leave();
					}
					return;
			}
			this.step++;
		})

		this.leave(async (ctx) => {});
	}

	private async chooseVaultStep(ctx: any) {
		const vaultNumber = parseInt(ctx.message.text);
		if (isNaN(vaultNumber) || vaultNumber < 1 || vaultNumber > this.options.length) {
			await ctx.reply('Некорректный номер счета. Попробуйте еще раз.');
			return;
		}
		this.currentVault = this.options[vaultNumber - 1];

		const inlineKeyboard = [];
		inlineKeyboard.push([ { text: 'Переименовать', callback_data: `${ACTION_CALLBACK_PREFIX}_${TITLE_ACTION}` } ])
		inlineKeyboard.push([ { text: 'Изменить валюту', callback_data: `${ACTION_CALLBACK_PREFIX}_${CURRENCY_ACTION}` } ]);
		if (this.currentVault.amount !== undefined) {
			inlineKeyboard.push([ { text: 'Изменить текущее значение', callback_data: `${ACTION_CALLBACK_PREFIX}_${AMOUNT_ACTION}` } ]);
		}
		inlineKeyboard.push([ { text: 'Деактивировать', callback_data: `${ACTION_CALLBACK_PREFIX}_${ACTIVE_STATE_ACTION}` } ]);

		await ctx.reply(`Что вы хотите сделать со счетом ${this.currentVault.title} (${this.currentVault.currency})?`, {
			reply_markup: {
				inline_keyboard: inlineKeyboard
			}
		});
	}

	private instructAction(ctx: any) {
		switch (this.currentAction) {
			case TITLE_ACTION:
				ctx.reply('Введите новое название счета');
				break;
			case CURRENCY_ACTION:
				ctx.reply('Введите новую валюту счета. Например, USD, EUR, RUB и т.д.');
				break;
			case AMOUNT_ACTION:
				ctx.reply('Введите новое текущее значение счета');
				break;
			case ACTIVE_STATE_ACTION:
				ctx.reply('Вы уверены, что хотите деактивировать этот счет?', {
					reply_markup: {
						inline_keyboard: [
							[{
								text: 'Да',
								callback_data: `${ACTION_CALLBACK_PREFIX}_${ACTIVE_STATE_ACTION}_${ACTIVE_STATE_ACTION_CONFIRM}`
							},
							{
								text: 'Нет',
								callback_data: `${ACTION_CALLBACK_PREFIX}_${ACTIVE_STATE_ACTION}_${ACTIVE_STATE_ACTION_CANCEL}`
							}]
						]
					}
				});
				break;
			default:
				ctx.reply('Неизвестное действие. Попробуйте еще раз.');
				break;
		}
	}

	private async performAction(ctx: any) {
		switch (this.currentAction) {
			case TITLE_ACTION:
				return this.editTitleAction(ctx);
			case CURRENCY_ACTION:
				return this.editCurrencyAction(ctx);
			case AMOUNT_ACTION:
				return this.editAmountAction(ctx);
			case ACTIVE_STATE_ACTION:
				return this.deactivateVaultAction(ctx);
			default:
				await ctx.reply('Неизвестное действие. Попробуйте еще раз.');
				return false;
		}
	}

	private async editTitleAction(ctx: any): Promise<boolean> {
		const newName = ctx.message.text;
		await this.service.renameVault(this.currentVault.id, newName);
		await ctx.reply(`Счет ${this.currentVault.title} переименован в ${newName}`);
		return true;
	}

	private async editCurrencyAction(ctx: any): Promise<boolean> {
		const newCurrency = ctx.message.text as Currency;
		if (!CURRENCY_CODES.includes(newCurrency)) {
			await ctx.reply('Неизвестная валюта. Попробуйте еще раз.');
			return false;
		}
		await this.service.changeVaultCurrency(this.currentVault.id, newCurrency);
		await ctx.reply(`Валюта счета ${this.currentVault.title} изменена на ${newCurrency}`);
		return true;
	}

	private async editAmountAction(ctx: any): Promise<boolean> {
		const newAmount = parseFloat(ctx.message.text);
		if (isNaN(newAmount)) {
			await ctx.reply('Некорректное значение. Попробуйте еще раз.');
			return false;
		}
		await this.service.changeVaultAmount(this.currentVault.id, newAmount);
		await ctx.reply(`Текущее значение счета ${this.currentVault.title} изменено на ${newAmount}`);
		return true;
	}

	private async deactivateVaultAction(ctx: any): Promise<boolean> {
		if (this.currentActionParams[0] !== ACTIVE_STATE_ACTION_CONFIRM) {
			await ctx.reply('Отмена деактивации счета');
			return true;
		}
		await this.service.changeVaultActiveState(this.currentVault.id, false);
		await ctx.reply(`Счет ${this.currentVault.title} деактивирован`);
		return true;
	}

	private resetState() {
		this.step = 0;
		this.options = [];
		this.currentAction = '';
		this.currentVault = undefined;
	}
}

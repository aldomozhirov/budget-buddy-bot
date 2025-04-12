import { Scenes, Telegraf } from 'telegraf';
import { BudgetBuddyContext, BudgetBuddySession } from '../types/session';
import {BudgetBuddyBotService} from "../service";
import {Currency, CURRENCY_CODES} from "current-currency/dist/types/currencies";

const SCENE_ID = 'createVault';

const INPUT_VAULT_NAME_STEP = 0;
const INPUT_VAULT_CURRENCY_STEP = 1;

export class CreateVaultScene extends Scenes.BaseScene<BudgetBuddyContext> {
	private readonly service: BudgetBuddyBotService;

	private step: number = 0;
	private name: string = '';
	private currency: Currency = 'EUR' as Currency;

	constructor(service: BudgetBuddyBotService) {
		super(SCENE_ID);
		this.service = service;


		this.enter(async(ctx) => {
			await ctx.reply('Введите название счета');
		})

		this.command('cancel', async (ctx) => {
			await ctx.reply('Отмена создания счета');
			this.resetStep();
			await ctx.scene.leave();
		})

		this.on('text', async (ctx) => {
			switch (this.step) {
				case INPUT_VAULT_NAME_STEP:
					this.name = ctx.message.text;
					await ctx.reply('Введите валюту счета. Например, USD, EUR, RUB и т.д.');
					break;
				case INPUT_VAULT_CURRENCY_STEP:
					this.currency = ctx.message.text as Currency;
					if (!CURRENCY_CODES.includes(this.currency))
					{
						await ctx.reply('Неизвестная валюта. Попробуйте еще раз.');
						return;
					}
					await this.service.createVault(this.name, this.currency, ctx.chat.id.toString());
					await ctx.reply(`Счет ${this.name} (${this.currency}) успешно создан!`);
					this.resetStep();
					await ctx.scene.leave();
					return;
			}
			this.step++;
		})

		this.leave(async (ctx) => {});
	}

	private resetStep() {
		this.step = 0;
	}
}

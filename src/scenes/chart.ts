import { createImage } from '../charts';
import { Scenes, Telegraf } from 'telegraf';
import { BudgetBuddyContext, BudgetBuddySession } from '../types/session';
import {spliceArrayIntoChunks} from "../utils";

const SCENE_ID = 'chart';
const ACTION_CALLBACK_PREFIX = 'chart';
const DEFAULT_CURRENCY = 'EQUIVALENCE';

export class ChartScene extends Scenes.BaseScene<BudgetBuddyContext> {
    private _bot: Telegraf<BudgetBuddyContext>;

    constructor(bot: Telegraf<BudgetBuddyContext>) {
        super(SCENE_ID);
        this._bot = bot;

        this.enter(async(ctx) => {
            await this.sendChart(ctx, DEFAULT_CURRENCY);
        })

        const regexp = new RegExp(`${ACTION_CALLBACK_PREFIX}+`);
        this.action(regexp, async (ctx) => {
            const currency = ctx.match.input.substring(ACTION_CALLBACK_PREFIX.length);
            await this.editChart(ctx, currency);
        });
    }

    private getKeys(amounts: { [key: string]: number[] }, currentCurrency: string) {
        return spliceArrayIntoChunks(Object.keys(amounts)
            .filter(key => key != currentCurrency)
            .map(key => ({
                text: key,
                callback_data: `${ACTION_CALLBACK_PREFIX}${key}`
            })), 2);
    }

    private async sendChart(ctx: { session: BudgetBuddySession, replyWithPhoto: any }, currency: string) {
        const { chartData } = ctx.session;
        if (!chartData) return;

        const { amounts, dates } = chartData;

        const { message_id: messageId, chat: { id: chatId } } = await ctx.replyWithPhoto(
            { source: await createImage([{ label: currency, data: amounts[currency] }], dates) },
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: this.getKeys(amounts, currency)
                }
            }
        );

        ctx.session.chartData = { ...chartData, chatId, messageId };
    }

    private async editChart(ctx: { session: BudgetBuddySession }, currency: string) {
        const { chartData } = ctx.session;
        if (!chartData) return;

        const { amounts, dates, chatId, messageId } = chartData;

        await this._bot.telegram.editMessageMedia(
            chatId,
            messageId,
            undefined,
            {
                type: 'photo',
                media: {
                    source: await createImage([{ label: currency, data: amounts[currency] }], dates)
                }
            },
            {
                // @ts-ignore
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: this.getKeys(amounts, currency)
                }
            }
        );
    }

}

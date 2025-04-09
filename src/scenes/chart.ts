import { createImage } from '../charts';
import { Scenes, Telegraf } from 'telegraf';
import { BudgetBuddyContext, BudgetBuddySession } from '../types/session';
import { spliceArrayIntoChunks } from '../utils';
import { getStatisticsWithEquivalence } from '../spreadsheets';
import {Currency} from "current-currency/dist/types/currencies";

const SCENE_ID = 'chart';
const ACTION_CALLBACK_PREFIX = 'chart';
const DEFAULT_CURRENCY = 'EQUIVALENCE';

export class ChartScene extends Scenes.BaseScene<BudgetBuddyContext> {
    private _bot: Telegraf<BudgetBuddyContext>;

    constructor(bot: Telegraf<BudgetBuddyContext>, equivalenceCurrency: Currency) {
        super(SCENE_ID);
        this._bot = bot;

        this.enter(async(ctx) => {
            await ctx.persistentChatAction('upload_photo', async () => {
                ctx.session.statistics = await getStatisticsWithEquivalence(ctx.session.auth, equivalenceCurrency);
            });
            await this.sendChart(ctx, DEFAULT_CURRENCY);
        })

        const regexp = new RegExp(`${ACTION_CALLBACK_PREFIX}+`);
        this.action(regexp, async (ctx) => {
            const currency = ctx.match.input.substring(ACTION_CALLBACK_PREFIX.length);
            if (!currency) {
                await ctx.scene.leave();
                return ctx.scene.enter('chart');
            }
            await this.editChart(ctx, currency);
        });

        this.leave(async (ctx) => {
            const { chartData } = ctx.session;
            if (chartData) {
                const { chatId, messageId } = chartData;
                await this._bot.telegram.deleteMessage(chatId, messageId);
                ctx.session.chartData = undefined;
            }
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
        const { statistics } = ctx.session;
        if (!statistics) return;

        const { amounts, dates } = statistics;

        const { message_id: messageId, chat: { id: chatId } } = await ctx.replyWithPhoto(
            { source: await createImage([{ label: currency, data: amounts[currency] }], dates) },
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: this.getKeys(amounts, currency)
                }
            }
        );

        ctx.session.chartData = { chatId, messageId, currency };
    }

    private async editChart(ctx: any, currency: string) {
        const { statistics, chartData } = ctx.session;
        if (!statistics || !chartData) return;

        const { chatId, messageId, currency: currentCurrency } = chartData;

        if (currency === currentCurrency) return;

        await this._bot.telegram.editMessageReplyMarkup(
            chatId,
            messageId,
            undefined,
            {
                inline_keyboard: []
            }
        );

        await this.sendChart(ctx, currency);

        // ctx.session.chartData = { ...chartData, currency };
    }

}

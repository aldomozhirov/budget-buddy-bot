import { createImage } from "../charts";
import { Scenes, Telegraf } from "telegraf";
import { BudgetBuddyContext, BudgetBuddySession } from "../types/bot";

const SCENE_ID = 'chart';
const ACTION_CALLBACK_PREFIX = 'chart';
const DEFAULT_CURRENCY = 'EQUIVALENCE';

export class ChartScene {
    private readonly _scene: Scenes.BaseScene<BudgetBuddyContext>;
    private _bot: Telegraf<BudgetBuddyContext>;

    constructor(bot: Telegraf<BudgetBuddyContext>) {
        this._bot = bot;
        this._scene = new Scenes.BaseScene<BudgetBuddyContext>(SCENE_ID);

        this._scene.enter(async(ctx) => {
            await this.sendChart(ctx, DEFAULT_CURRENCY);
        })

        const regexp = new RegExp(`${ACTION_CALLBACK_PREFIX}+`);
        this._scene.action(regexp, async (ctx) => {
            const currency = ctx.match.input.substring(ACTION_CALLBACK_PREFIX.length);
            await this.editChart(ctx, currency);
        });
    }

    public get scene() {
        return this._scene;
    }

    private async sendChart(ctx: { session: BudgetBuddySession, replyWithPhoto: any }, currency: string) {
        const { chartData } = ctx.session;
        if (!chartData) return;

        const { amounts, dates } = chartData;

        const keys = Object.keys(amounts)
            .filter(key => key != currency)
            .map(key => ({
                text: key,
                callback_data: `${ACTION_CALLBACK_PREFIX}${key}`
            }));

        const { message_id: messageId, chat: { id: chatId } } = await ctx.replyWithPhoto(
            { source: await createImage([{ label: currency, data: amounts[currency] }], dates) },
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [keys]
                }
            }
        );

        ctx.session.chartData = { ...chartData, chatId, messageId };
    }

    private async editChart(ctx: { session: BudgetBuddySession }, currency: string) {
        const { chartData } = ctx.session;
        if (!chartData) return;

        const { amounts, dates, chatId, messageId } = chartData;

        const keys = Object.keys(amounts)
            .filter(key => key != currency)
            .map(key => ({
                text: key,
                callback_data: `${ACTION_CALLBACK_PREFIX}${key}`
            }));

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
                    inline_keyboard: [keys]
                }
            }
        );
    }

}

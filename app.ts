import 'dotenv/config';
import { Scenes, session, Telegraf } from 'telegraf';
import { Pool, appendPool, findActivePoolByChatId } from './src/pools';
import { formatSummaryByCurrency, formatEquivalence, formatDate } from './src/formatters';
import { BudgetBuddyContext, BudgetBuddySession } from './src/types/session';
import { ChartScene } from './src/scenes/chart';
// @ts-ignore
import mexp from 'math-expression-evaluator';
import {Currency} from "current-currency/dist/types/currencies";
import {Persistence} from "./src/persistence";
import {DatabasePersistence} from "./src/persistence/db";

const API_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || 'https://budget-buddy-bot.herokuapp.com';
const EQUIVALENCE_CURRENCY = (process.env.EQUIVALENCE_CURRENCY) as Currency || 'USD';
const STAGE_TTL = 100;

const bot = new Telegraf<BudgetBuddyContext>(process.env.TELEGRAM_BOT_TOKEN || '');

const persistence: Persistence = new DatabasePersistence();
const stage = new Scenes.Stage<BudgetBuddyContext>(
    [
        new ChartScene(bot, persistence, EQUIVALENCE_CURRENCY)
    ],
    {
        ttl: STAGE_TTL
    }
);

bot.use(session());
bot.use(stage.middleware());
bot.use((ctx, next) => {
    ctx.session.isWaitingForCode ??= false;
    return next();
});

const sendQuestion = async (session: BudgetBuddySession, chatId: number, text: string) => {
    const message = await bot.telegram.sendMessage(chatId, text, {
        reply_markup: {
            inline_keyboard: [
                [ { text: 'Не изменилось', callback_data: `next${chatId}` } ]
            ]
        }
    });
    session.lastMessageId = message.message_id;
    return message;
}

const getSummaryMessages = async (): Promise<any> => {
    const summaryByCurrency = await persistence.getLatestSummaryByCurrency(EQUIVALENCE_CURRENCY);
    if (!summaryByCurrency) {
        return null;
    }
    const { byCurrency, equivalence, date } = summaryByCurrency;

    let summaryText;
    let equivalenceText;
    const previousSummaryByCurrency = await persistence.getPreviousSummaryByCurrency(EQUIVALENCE_CURRENCY);
    if (!previousSummaryByCurrency) {
        summaryText = formatSummaryByCurrency(byCurrency);
        equivalenceText = formatEquivalence(equivalence);
    } else {
        const {
            byCurrency: byCurrencyOld,
            equivalence: equivalenceOld
        } = previousSummaryByCurrency;
        summaryText = formatSummaryByCurrency(byCurrency, byCurrencyOld);
        equivalenceText = formatEquivalence(equivalence, equivalenceOld);
    }

    return { summaryText, equivalenceText, date: formatDate(date) };
}

const finalisePool = async (chatId: number, pool: Pool, session: BudgetBuddySession) => {
    await bot.telegram.sendMessage(
        chatId,
        `📝 Я запомнил ваши значения. Теперь мы ждем когда другие участники подсчета закончат ввод значений и после этого, я пришлю вам результаты.`
    );

    const column = await persistence.createColumn();
    for(const answer of pool.answers) {
        await persistence.setValue(column, answer.id, answer.text);
    }
    const allSet = await persistence.checkAllValuesSet(column);
    if (allSet) {
        const recipients = await persistence.getAllRecipients();
        const { summaryText, equivalenceText, date } = await getSummaryMessages();
        const message = `Подсчет завершен 👏 Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`;
        for (const chatId of recipients) {
            await bot.telegram.sendMessage(chatId, message,{
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Посмотреть график 📊', callback_data: 'chart'}]
                    ]
                }
            });
        }
    }
}

const processValue = async (chatId: number, session: BudgetBuddySession, text?: string) => {
    const pool = findActivePoolByChatId(chatId);
    if (!pool) return;

    const value = text || pool.getCurrentQuestion().data.previousValue.toString();
    let evalValue;
    try {
        evalValue = mexp.eval(value);
    } catch (e) {
        await bot.telegram.sendMessage(chatId, 'Неверное значение');
        await sendQuestion(session, chatId, pool.getCurrentQuestion().text);
        return;
    }

    pool.saveAnswer(evalValue);
    await bot.telegram.editMessageReplyMarkup(chatId, session.lastMessageId, undefined, {
        inline_keyboard: []
    })
    await bot.telegram.sendMessage(
        chatId,
        `Сохранено значение ${evalValue}`
    );

    if (pool.isActive) {
        await sendQuestion(session, chatId, pool.getCurrentQuestion().text);
    } else {
        await finalisePool(chatId, pool, session);
    }
}

bot.command('start', async (ctx: any) => {
    const chatId = ctx.message.chat.id;

    const paymentSources = await persistence.getPaymentSources();
    const latestValues = await persistence.getLatestValues();
    const userPaymentSources = paymentSources
            .filter((source: any) => parseInt(source.chatId) === chatId)
            .map((source: any) => ({
                id: source.id,
                text: `${source.name} ${source.currency} (${latestValues[source.id]})`,
                data: { previousValue: latestValues[source.id] }
            }));

    if (userPaymentSources.length) {
        const pool = new Pool(chatId, userPaymentSources);
        appendPool(pool);
        await sendQuestion(ctx.session, chatId, pool.getCurrentQuestion().text);
    }
})

bot.command('summary', async (ctx: any) => {
    let summaryMessages: any = {};
    await ctx.persistentChatAction('typing', async () => {
        summaryMessages = await getSummaryMessages();
    });
    const { summaryText, equivalenceText, date } = summaryMessages;

    await ctx.reply(
        `Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Посмотреть график 📊', callback_data: 'chart'}]
                ]
            }
        }
    );
})

bot.command('vaults', async (ctx: any) => {
    const vaults = await persistence.getUserVaults(ctx.message.chat.id.toString());
    if (!vaults.length) {
        await ctx.reply('Вы еще не добавили ни одного счета');
        return;
    }

    const vaultsText = vaults.map(vault => `${vault.title} (${vault.amount} ${vault.currency})`).join('\n');
    await ctx.reply(`Ваши счета:\n\n${vaultsText}`);
})

bot.on('text', async (ctx: any) => {
    const {
        message: {
            text,
            chat: { id: chatId }
        },
        session
    } = ctx;

    await processValue(chatId, session, text);
});

bot.action(/next+/, async (ctx: any) => {
    const chatId = parseInt(ctx.match.input.substring(4));
    await processValue(chatId, ctx.session);
    ctx.answerCbQuery();
});

bot.action('chart', async (ctx: any) => {
    ctx.editMessageReplyMarkup({  inline_keyboard: [] })
    await ctx.scene.enter('chart');
});

if (process.env.NODE_ENV === 'production') {
    bot.telegram.setWebhook(`${URL}/bot${API_TOKEN}`);
    // @ts-ignore
    bot.startWebhook(`/bot${API_TOKEN}`, null, PORT);
} else {
    bot.launch();
}

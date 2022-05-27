import 'dotenv/config';
import { Telegraf } from 'telegraf';
import {
    createColumn,
    getPaymentSources,
    setValue,
    checkAllValuesSet,
    getAllRecipients,
    getLatestSummaryByCurrency,
    getLatestValues,
    getPreviousSummaryByCurrency
} from './src/spreadsheets';
import { Pool, appendPool, findActivePoolByChatId } from './src/pools';
import { formatSummaryByCurrency, formatEquivalence } from './src/formatters';
import { getAuth, storeNewToken } from './src/spreadsheets/auth';
import { OAuth2Client } from "google-auth-library";

const API_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || 'https://budget-buddy-bot.herokuapp.com';
const EQUIVALENCE_CURRENCY = 'EUR';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
let isWaitingForCode = false;

const authorizeSpreadsheets = (chatId: number) => {
    return getAuth(async (authUrl: string) => {
        isWaitingForCode = true;
        await bot.telegram.sendMessage(chatId,
            '🤖 Кажется, я не могу получить доступ к вашей Google Spreadsheet таблице.\nПожалуйста, авторизуруйтесь в Google, нажав на кнопку ниже и пришлите мне токен аутентификации.',
            {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: 'Аутентифицироваться в Google', url: authUrl } ]
                    ]
                }
            });
    });
}

const sendQuestion = (chatId: number, text: string) => {
    return bot.telegram.sendMessage(chatId, text, {
        reply_markup: {
            inline_keyboard: [
                [ { text: 'Не изменилось', callback_data: `next${chatId}` } ]
            ]
        }
    });
}

const getSummaryMessages = async (auth: OAuth2Client): Promise<any> => {
    const summaryByCurrency = await getLatestSummaryByCurrency(auth, EQUIVALENCE_CURRENCY);
    if (!summaryByCurrency) {
        return null;
    }
    const { byCurrency, equivalence, date } = summaryByCurrency;

    let summaryText;
    let equivalenceText;
    const previousSummaryByCurrency = await getPreviousSummaryByCurrency(auth, EQUIVALENCE_CURRENCY);
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

    return { summaryText, equivalenceText, date };
}

const finalisePool = async (chatId: number, pool: Pool) => {
    await bot.telegram.sendMessage(
        chatId,
        `📝 Я запомнил ваши значения. Теперь мы ждем когда другие участники подсчета закончат ввод значений и после этого, я пришлю вам результаты.`
    );

    let auth;
    try {
        auth = await authorizeSpreadsheets(chatId);
    } catch (err) {}
    if (!auth) return;

    const column = await createColumn(auth);
    for(const answer of pool.answers) {
        await setValue(auth, column, answer.id, answer.text);
    }
    const allSet = await checkAllValuesSet(auth, column);
    if (allSet) {
        const recipients = await getAllRecipients(auth);
        const { summaryText, equivalenceText, date } = await getSummaryMessages(auth);
        const message = `Подсчет завершен 👏 Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`;
        for (const chatId of recipients) {
            await bot.telegram.sendMessage(chatId, message);
        }
    }
}

const processValue = async (chatId: number, text?: string) => {
    const pool = findActivePoolByChatId(chatId);
    if (!pool) return;

    const value = text || pool.getCurrentQuestion().data.previousValue;
    if (isNaN(parseInt(value))) {
        await bot.telegram.sendMessage(chatId, 'Неверное значение');
        await sendQuestion(chatId, pool.getCurrentQuestion().text);
        return;
    }

    pool.saveAnswer(value);
    if (pool.isActive) {
        await sendQuestion(chatId, pool.getCurrentQuestion().text);
    } else {
        await finalisePool(chatId, pool);
    }
}

bot.command('start', async (ctx: any) => {
    const chatId = ctx.message.chat.id;

    let auth;
    try {
        auth = await authorizeSpreadsheets(chatId);
    } catch (err) {}
    if (!auth) return;

    const paymentSources = await getPaymentSources(auth);
    const latestValues = await getLatestValues(auth);
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
        await sendQuestion(chatId, pool.getCurrentQuestion().text);
    }
})

bot.command('summary', async (ctx: any) => {
    const chatId = ctx.message.chat.id;

    let auth;
    try {
        auth = await authorizeSpreadsheets(chatId);
    } catch (err) {}
    if (!auth) return;

    const { summaryText, equivalenceText, date } = await getSummaryMessages(auth);
    await ctx.reply(
        `Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`
    );
})

bot.on('text', async (ctx: any) => {
    const {
        message: {
            text,
            chat: { id: chatId }
        }
    } = ctx;

    if (isWaitingForCode) {
        await storeNewToken(text);
        isWaitingForCode = false;
        ctx.reply('🤖 Сработало! Теперь можете выполнить команду.');
    }

    await processValue(chatId, text);
});

bot.action(/next+/, async (ctx: any) => {
    const chatId = parseInt(ctx.match.input.substring(4));
    await processValue(chatId);
});

if (process.env.NODE_ENV === 'production') {
    bot.telegram.setWebhook(`${URL}/bot${API_TOKEN}`);
    // @ts-ignore
    bot.startWebhook(`/bot${API_TOKEN}`, null, PORT);
} else {
    bot.launch();
}

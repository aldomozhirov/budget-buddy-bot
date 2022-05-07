require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const {
    createColumn,
    getPaymentSources,
    setValue,
    checkAllValuesSet,
    getAllRecipients,
    getLatestSummaryByCurrency
} = require('./src/spreadsheets');
const { Pool, appendPool, findActivePoolByChatId } = require('./src/pools');
import { getAuth, storeNewToken } from './src/spreadsheets/auth';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

type TEquivalence = {
    amount: number;
    currency: string;
};

let isWaitingForCode = false;

const formatSummaryByCurrency = (summary: any) => {
    let text = '';
    for (const currency of Object.keys(summary)) {
        text += `Сумма в ${currency}: ${summary[currency].toFixed(2)}\n`;
    }
    return text;
}

const formatEquivalence = (equivalence: TEquivalence) => {
    const formattedAmount = equivalence.amount.toFixed(2);
    return `Эквивалент в переводе на ${equivalence.currency}: ${formattedAmount}`;
}

const authorizeSpreadsheets = (ctx: any) => {
    return getAuth((authUrl: string) => {
        isWaitingForCode = true;
        ctx.reply(`Введите код с данной страницы: ${authUrl}`);
    });
}

bot.command('start', async (ctx: any) => {
    let auth;
    try {
        auth = await authorizeSpreadsheets(ctx);
    } catch (err) {
        if (err) return;
    }

    const paymentSources = await getPaymentSources(auth);
    const chatId = ctx.message.chat.id;
    const userPaymentSources = paymentSources
            .filter((source: any) => parseInt(source.chatId) === chatId)
            .map((source: any) => ({id: source.id, text: `${source.name} (${source.currency})`}))

    if (userPaymentSources.length) {
        const pool = new Pool(chatId, userPaymentSources);
        appendPool(pool);
        ctx.reply(pool.getCurrentQuestion().text, Markup.forceReply());
    }
})

bot.command('summary', async (ctx: any) => {
    let auth;
    try {
        auth = await authorizeSpreadsheets(ctx);
    } catch (err) {
        if (err) return;
    }

    const summaryByCurrency = await getLatestSummaryByCurrency(auth, 'EUR');
    if (!summaryByCurrency) {
        ctx.reply('Нет данных');
        return;
    }

    const { byCurrency, date, equivalence } = summaryByCurrency;
    const summaryText = formatSummaryByCurrency(byCurrency);
    const equivalenceText = formatEquivalence(equivalence);
    ctx.reply(`Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`);
})

bot.on('text', async (ctx: any) => {
    const { text } = ctx.message;
    if (isWaitingForCode) {
        await storeNewToken(text);
    }
    const pool = findActivePoolByChatId(ctx.message.chat.id);
    if (pool) {
        if (isNaN(text)) {
            ctx.reply('Неверное значение');
            ctx.reply(pool.getCurrentQuestion().text, Markup.forceReply());
            return;
        }
        pool.saveAnswer(ctx.message.text);
        if (pool.isActive) {
            ctx.reply(pool.getCurrentQuestion().text, Markup.forceReply());
        } else {
            let auth;
            try {
                auth = await authorizeSpreadsheets(ctx);
            } catch (err) {
                if (err) return;
            }
            const column = await createColumn(auth);
            for(const answer of pool.answers) {
                await setValue(auth, column, answer.id, answer.text);
            }
            const allSet = await checkAllValuesSet(auth, column);
            if (allSet) {
                const recipients = await getAllRecipients(auth);
                const { byCurrency, date, equivalence } = await getLatestSummaryByCurrency(auth, 'EUR');
                for (const chatId of recipients) {
                    const summaryText = formatSummaryByCurrency(byCurrency);
                    const equivalenceText = formatEquivalence(equivalence);
                    await bot.telegram.sendMessage(
                        parseInt(chatId),
                        `Подсчет завершен 👏 Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`
                    );
                }
            }
        }
    }
});

bot.launch();

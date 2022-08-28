import express from 'express';
import bot from './bot';
import Joi from 'joi';

const API_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || 'http://localhost';

const notifySchema = Joi.object({
    chatId: Joi.number().required()
});

const app = express();

app.use(express.json());

app.get('/health', async (req, res) => {
    res.json({ health: 'ok' })
});

app.get('/notify', async (req, res) => {
    const { chatId } = Joi.attempt(req.query, notifySchema);
    await bot.telegram.sendMessage(
        chatId,
        'Пришло время подсчитать итоги этого месяца. Готовы?',
        {
            reply_markup: {
                inline_keyboard: [
                    [ { text: 'Начать', callback_data: `start` } ]
                ]
            }
        }
    );
    res.json({ chatId });
});

if (process.env.NODE_ENV === 'production') {
    app.use(bot.webhookCallback('/bot'));
    bot.telegram.setWebhook(`${URL}/bot${API_TOKEN}`);
    // @ts-ignore
    bot.startWebhook(`/bot${API_TOKEN}`, null, PORT);
} else {
    bot.launch();
}

app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at ${URL}:${PORT}`);
});

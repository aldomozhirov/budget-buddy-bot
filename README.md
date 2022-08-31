# Budget Buddy Bot

Telegram Bot helping to keep your finances under control

## Stack

- Node.js `>14.x.x`
- NPM `>8.x.x`
- Typescript
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Telegraf.js](https://telegrafjs.org/)
- [Chart.js](https://www.chartjs.org/)

## Capabilities

This Telegram bot is intended to keep track of your personal finances distributed among various bank accounts and currencies, and provides an easy to read and understand summary of your overall budget.

It uses Google Sheets API to store and access your financial data to/from Google Spreadsheets document on your Google Drive. So, only you are in charge to manage access to this Spreadsheet document. Budget Buddy Bot does not send your financial data anywhere except for your own Google Spreadsheet document!

This bot supports having several people attached to the same budget. It means that you can configure it in a way that your wife, children or anyone will be asked for their financial data, which will be considered as part of the same budget.

### Available commands

#### /start
Initiates pool of your bank accounts and other payment sources state. 

When this command triggered, it takes from the Spreadsheet a list of payment sources belonging to you, based on your Telegram chat ID and asks you to provide exact amount of money remaining on each of your payment sources.

<img width="300" alt="start command example" src="https://user-images.githubusercontent.com/17453908/187720210-25ba76fb-65a9-4d5b-8fbb-f0d9f2110fe8.PNG">

If you have several accounts under the same payment source in the same currency, and you want to summarise their amounts before storing them, or you want to apply any other mathematical operations to it, you can do it right in the message reply. Bot accepts any mathematical expression as a reply to his requests, so you can send him something like:
```shell
(11244.14 + 12441.12) / 2 * 10%
```
and bot will store the resulting value `1184.26` as an amount on the requested payment source.

#### /summary
On this command bot will reply with an overall summary of your budget, aggregated by currencies. It also will build a line chart based on your historical data for each currency, if you will ask him to do it, by pressing a button.

<img width="300" alt="summary command example" src="https://user-images.githubusercontent.com/17453908/187720285-a811b1b2-d41b-4cc0-8bf2-431910a775de.PNG">

## Getting Started

1. Create your Telegram Bot using [@BotFather](https://t.me/BotFather) and note bot token
2. Create GCP account and obtain credentials to access [Google Sheets API](https://developers.google.com/sheets/api)
3. Create Google Spreadsheet document, note document ID and sheet name
4. Fill created Spreadsheet with information about your payment sources in format of table with following columns:
    <img width="500" alt="spreadsheet example" src="https://user-images.githubusercontent.com/17453908/187718941-4de070bf-cda2-49fe-950c-b0dbfd41f480.png">
    - **ID** - unique identifier number of the payment source (ex: 1, 2, ...)
    - **Source** - name of the payment source (ex: Wise, Citibank)
    - **Currency** - currency identifier in ISO format (ex: EUR, USD)
    - **Telegram ID** - Telegram chat identifier of payment source owner (ex: 122559221)
    - **Active** - flag indicating if the account is still active (options: 1 or 0)
5. Clone this repo and define following environment variables on your machine (preferably using `.env` file):
    ```shell
    TELEGRAM_BOT_TOKEN=<your telegram bot Token from step 1>
    GOOGLE_API_CREDENTIALS=<google api credentials json from step 2>
    SPREADSHEET_ID=<spreadsheet id from step 3>
    SHEET_NAME=<sheet name in your spreadsheet document from step 3>
    EQUIVALENCE_CURRENCY=<preferable currency to calculate total amount equivalence>
    ```
6. Install project dependencies with `npm install`   
7. Run application in development mode using command `npm run dev`
8. Open conversation with your bot in Telegram
9. Hit `/start` command to launch your first amounts pool

## Deploying on Heroku
This project is 100% compatible with Heroku. Follow these steps to deploy the application there:
1. If you don't have account on Heroku yet, [sign up here](https://signup.heroku.com/)
2. Login to your Heroku account and create new project
3. Go to Settings, click `Reveal Config Vars` and add following vars:
   ```shell
   NODE_ENV=production
   NODE_OPTIONS=--max_old_space_size=2560
   TELEGRAM_BOT_TOKEN=<your telegram bot Token>
   GOOGLE_API_CREDENTIALS=<google api credentials json>
   SPREADSHEET_ID=<spreadsheet id>
   SHEET_NAME=<sheet name in your spreadsheet document>
   EQUIVALENCE_CURRENCY=<preferable currency to calculate total amount equivalence>
   ```
4. Deploy this project using [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)


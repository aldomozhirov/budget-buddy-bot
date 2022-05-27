import { google } from 'googleapis';
import { convert } from 'current-currency';
import { Currency } from 'current-currency/dist/types/currencies';
import { getCurrentMonthString, colName } from '../utils';
import { OAuth2Client } from 'google-auth-library';

const spreadsheetId = process.env.SPREADSHEET_ID;
const sheetName = process.env.SHEET_NAME;
const staticColumns = [
    'id',
    'name',
    'currency',
    'chatId',
    'active'
]

async function getDates(sheets: any) {
    try {
        const firstDynamicColumn = colName(staticColumns.length);
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!${firstDynamicColumn}1:1`
        })
        return res.data.values ? res.data.values[0] : [];
    } catch (err) {
        console.log('The API returned an error: ' + err);
    }
}

async function getValueTargetRowById(auth: OAuth2Client, sheets: any, id: number): Promise<number> {
    const sources = await getPaymentSources(auth);
    const index = sources.findIndex((source: any) => source.id === id);
    return index === -1 ? -1 : index + 2;
}

async function getColumnValues(auth: OAuth2Client, column: string): Promise<any> {
    const sheets = google.sheets({version: 'v4', auth});
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!${column}2:${column}`
        })
        if (res.data.values) {
            return res.data.values.map(value => value.length ? value[0] : null);
        } else {
            return [];
        }
    } catch (err) {
        console.log('The API returned an error: ' + err);
    }
}

async function getLatestDateColumn(auth: OAuth2Client) {
    const sheets = google.sheets({ version: 'v4', auth });
    const dates = await getDates(sheets);

    if (!dates.length) return null;

    return {
        column: colName(staticColumns.length + dates.length - 1),
        date: dates.pop()
    };
}

export async function getPaymentSources(auth: OAuth2Client): Promise<any> {
    const sheets = google.sheets({version: 'v4', auth});
    try {
        const lastStaticColumn = colName(staticColumns.length - 1);
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A2:${lastStaticColumn}`,
        })
        const rows: any[][] | undefined = res.data.values;
        if (rows && rows.length) {
            return rows.map((row) => {
                const result: any = {};
                for (let i = 0; i < staticColumns.length; i++) {
                    const column = staticColumns[i];
                    result[column] = row[i];
                }
                return result;
            });
        } else {
            return [];
        }
    } catch (err) {
        console.log('The API returned an error: ' + err);
    }
}

export async function createColumn(auth: OAuth2Client): Promise<string> {
    const sheets = google.sheets({version: 'v4', auth});

    const month = getCurrentMonthString();
    const dates = await getDates(sheets);
    let index = dates.findIndex((col: any) => col === month);
    if (index !== -1) {
        return colName(staticColumns.length + index)
    }

    const column = colName(staticColumns.length + dates.length)
    // @ts-ignore
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${column}1:${column}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
            majorDimension: 'COLUMNS',
            values: [[getCurrentMonthString()]]
        }
    });
    return column;
}

export async function setValue(auth: OAuth2Client, column: string, id: number, value: string) {
    const sheets = google.sheets({version: 'v4', auth});
    const row = await getValueTargetRowById(auth, sheets, id);
    const cell = `${column}${row}`;
    try {
        // @ts-ignore
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!${cell}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                majorDimension: 'COLUMNS',
                values: [[value]]
            }
        });
    } catch (err) {
        console.log('The API returned an error: ' + err);
    }
}

export async function checkAllValuesSet(auth: OAuth2Client, column: string) {
    const sources = await getPaymentSources(auth);
    const values = await getColumnValues(auth, column);
    const definedValues = values.filter(Boolean);
    return sources.length === definedValues.length;
}

export async function getAllRecipients(auth: OAuth2Client): Promise<string[]> {
    const sources = await getPaymentSources(auth);
    // @ts-ignore
    const recipients = sources.map((source) => source.chatId).filter(s => s);
    return [...new Set(recipients)] as string[];
}

export async function getLatestValues(auth: OAuth2Client): Promise<any> {
    const latestDateColumnData = await getLatestDateColumn(auth);
    if (!latestDateColumnData) return null;

    const { column } = latestDateColumnData;

    const sources = await getPaymentSources(auth);
    const values = await getColumnValues(auth, column);

    const result: any = {};
    for (let i = 0; i < sources.length; i++) {
        result[sources[i].id] = values[i] ? parseFloat(values[i]) : 0;
    }

    return result;
}

export async function getLatestSummaryByCurrency(auth: OAuth2Client, equivalenceCurrency: Currency): Promise<any> {
    const latestDateColumnData = await getLatestDateColumn(auth);
    if (!latestDateColumnData) return null;

    const { column, date } = latestDateColumnData;

    const sources = await getPaymentSources(auth);
    const values = await getColumnValues(auth, column);

    const byCurrency: any = {};
    for (let i = 0; i < sources.length; i++) {
        const currency = sources[i].currency;
        const value = values[i] ? parseFloat(values[i]) : 0;
        if (!byCurrency.hasOwnProperty(currency)) {
            byCurrency[currency] = value;
        } else {
            byCurrency[currency] += value;
        }
    }

    let equivalenceAmount = 0;
    for (const currency of Object.keys(byCurrency)) {
        if (currency === equivalenceCurrency) {
            equivalenceAmount += byCurrency[currency];
        } else {
            const { amount } = await convert(currency as Currency, byCurrency[currency], equivalenceCurrency);
            equivalenceAmount += amount;
        }
    }

    return {
        date,
        byCurrency,
        equivalence: {
            currency: equivalenceCurrency,
            amount: equivalenceAmount
        }
    };
}

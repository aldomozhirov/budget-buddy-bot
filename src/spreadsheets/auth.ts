import fs from 'fs';
import { google } from 'googleapis';
import { Credentials } from 'google-auth-library/build/src/auth/credentials';
import { OAuth2Client } from 'google-auth-library';

// If modifying these scopes, delete token.json.
const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
async function getOAuth2Client(): Promise<OAuth2Client> {
    const content = await fs.readFileSync('credentials.json').toString();
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

export async function getAuth(callback: any) {
    try {
        const oAuth2Client = await getOAuth2Client();
        return authorize(oAuth2Client, callback);
    } catch (err) {
        console.log('Error loading client secret file:', err);
    }
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param oAuth2Client
 * @param callback
 */
async function authorize(oAuth2Client: OAuth2Client, callback: any): Promise<OAuth2Client> {
    try {
        const token = await fs.readFileSync(TOKEN_PATH).toString();
        oAuth2Client.setCredentials(JSON.parse(token));
    } catch (err) {
        console.log(err);
        if (err) {
            const authUrl = getAuthUrl(oAuth2Client);
            await callback(authUrl);
            throw err;
        }
    }
    return oAuth2Client;
}

function getAuthUrl(oAuth2Client: any): string {
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param code
 */
export async function storeNewToken(code: string): Promise<OAuth2Client> {
    const oAuth2Client = await getOAuth2Client();
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', TOKEN_PATH);
        });
    } catch (err) {
        if (err) console.error('Error while trying to retrieve access token', err);
    }
    return oAuth2Client;
}

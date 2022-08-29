import { Context, Scenes } from 'telegraf';
import { OAuth2Client } from 'google-auth-library';

interface BudgetBuddySession extends Scenes.SceneSession {
    statistics?: Statistics;
    chartData?: ChartData;
    isWaitingForCode: boolean;
    auth: OAuth2Client;
}

interface BudgetBuddyContext extends Context {
    session: BudgetBuddySession;
    scene: Scenes.SceneContextScene<BudgetBuddyContext>;
}

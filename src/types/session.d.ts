import { Context, Scenes } from 'telegraf';

interface BudgetBuddySession extends Scenes.SceneSession {
    chartData?: ChartData;
    isWaitingForCode: boolean;
}

interface BudgetBuddyContext extends Context {
    session: BudgetBuddySession;
    scene: Scenes.SceneContextScene<BudgetBuddyContext>;
}

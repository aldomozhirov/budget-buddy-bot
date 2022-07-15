import { Context, Scenes } from "telegraf";

type TEquivalence = {
    amount: number;
    currency: string;
};

interface ChartData {
    amounts: { [key: string]: number[] };
    dates: string[];
    chatId?: number;
    messageId?: number;
}

interface BudgetBuddySession extends Scenes.SceneSession {
    chartData?: ChartData;
    isWaitingForCode: boolean;
}

interface BudgetBuddyContext extends Context {
    session: BudgetBuddySession;
    scene: Scenes.SceneContextScene<BudgetBuddyContext>;
}

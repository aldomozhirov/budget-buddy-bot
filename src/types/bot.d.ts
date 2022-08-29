type TEquivalence = {
    amount: number;
    currency: string;
};

interface Statistics {
    amounts: { [key: string]: number[] },
    dates: string[]
}

interface ChartData {
    chatId: number;
    messageId: number;
    currency: string;
}

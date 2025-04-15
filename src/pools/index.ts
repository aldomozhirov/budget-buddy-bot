const index: Pool[] = [];

export class Pool {
    chatId: number;
    isActive: boolean;
    private readonly questions: TQuestion[];
    readonly answers: TAnswer[];
    private index: number;

    constructor(chatId: number, questions: TQuestion[]) {
        this.chatId = chatId;
        this.questions = questions;
        this.answers = [];
        this.index = 0;
        this.isActive = true;
    }

    getCurrentQuestion(): TQuestion {
        return this.questions[this.index];
    }

    saveAnswer(text: string) {
        if (!this.isActive) return;

        this.answers.push({ id: this.getCurrentQuestion().id, text });

        if (this.index + 1 === this.questions.length) {
            this.isActive = false;
        } else {
            this.index++;
        }
    }

    isFirstQuestion(): boolean {
        return this.index === 0;
    }

    goToPreviousQuestion() {
        if (this.index > 0) {
            this.answers.pop();
            this.index--;
        }
    }
}

export const appendPool = (pool: Pool) => {
    index.push(pool);
}

export const findActivePoolByChatId = (chatId: number) => {
    return index.find((pool) => pool.chatId === chatId && pool.isActive)
}

const index: Pool[] = [];

type TQuestion = {
    id: number;
    text: string;
}

type TAnswer = {
    id: number;
    text: string;
}

class Pool {

    chatId: number;
    isActive: boolean;
    private readonly questions: TQuestion[];
    private answers: TAnswer[];
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
}

const appendPool = (pool: Pool) => {
    index.push(pool);
}

const findActivePoolByChatId = (chatId: number) => {
    return index.find((pool) => pool.chatId === chatId && pool.isActive)
}

export = { appendPool, findActivePoolByChatId, Pool }


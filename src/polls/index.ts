const index: Poll[] = [];

export class Poll {
    chatId: number;
    pollId: number;
    isActive: boolean;
    private readonly questions: TQuestion[];
    readonly answers: TAnswer[];
    private index: number;

    constructor(chatId: number, pollId: number, questions: TQuestion[]) {
        this.chatId = chatId;
        this.pollId = pollId;
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

export const appendPoll = (poll: Poll) => {
    index.push(poll);
}

export const findActivePollByChatId = (chatId: number) => {
    return index.find((poll) => poll.chatId === chatId && poll.isActive)
}

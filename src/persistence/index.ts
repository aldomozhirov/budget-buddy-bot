import {Currency} from "current-currency/dist/types/currencies";

export abstract class Persistence {

	public abstract createColumn(): Promise<string>;

	public abstract getPaymentSources(): Promise<any[]>;

	public abstract setValue(column: string, id: number, value: string): Promise<void>;

	public abstract checkAllValuesSet(column: string): Promise<boolean>;

	public abstract getAllRecipients(): Promise<string[]>;

	public abstract getLatestValues(): Promise<any>;

	public abstract getLatestSummaryByCurrency(equivalenceCurrency: Currency): Promise<any>;

	public abstract getPreviousSummaryByCurrency(equivalenceCurrency: Currency): Promise<any>;

	public abstract getStatisticsWithEquivalence(equivalenceCurrency: Currency): Promise<Statistics>;
}

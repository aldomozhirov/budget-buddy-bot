import {Currency} from "current-currency/dist/types/currencies";
import {PrismaClient} from '../../generated/prisma'
import {convert} from "current-currency";


export class BudgetBuddyBotService
{
	private readonly prisma = new PrismaClient();

	public async checkAllValuesSet(column: string): Promise<boolean>
	{
		const poll = await this.prisma.poll.findFirst({
			where: {
				id: parseInt(column)
			},
			include: { statuses: true }
		})
		const vaults = await this.prisma.vault.findMany({ where: { active: true } })
		return poll?.statuses.length === vaults.length;
	}

	public async createColumn(): Promise<string>
	{
		const poll = await this.prisma.poll.create({})
		return poll.id.toString();
	}

	public async getAllRecipients(): Promise<string[]>
	{
		const users = await this.prisma.user.findMany()
		return users.map(user => user.telegram_id)
	}

	public async getLatestSummaryByCurrency(equivalenceCurrency: Currency): Promise<any>
	{
		const poll = await this.prisma.poll.findFirst({
			orderBy: {
				createdAt: 'desc'
			},
			include: { statuses: { include: { vault: true } } }
		})
		return this.getPollSummary(poll, equivalenceCurrency);
	}

	public async getPreviousSummaryByCurrency(equivalenceCurrency: Currency): Promise<any>
	{
		const lastPolls = await this.prisma.poll.findMany({
			orderBy: {
				createdAt: 'desc'
			},
			include: { statuses: { include: { vault: true } } }
		})

		if (lastPolls.length < 2) {
			return undefined;
		}

		return this.getPollSummary(lastPolls[1], equivalenceCurrency);
	}

	public async getLatestValues(): Promise<any>
	{
		const poll = await this.prisma.poll.findFirst({
			orderBy: {
				createdAt: 'desc'
			},
			include: { statuses: true }
		})

		if (!poll) {
			throw new Error('No poll found');
		}

		const values: any = {};
		poll.statuses.forEach(vaultStatus => {
			values[vaultStatus.vaultId] = vaultStatus.amount
		});

		return values;
	}

	public async getPaymentSources(): Promise<any[]>
	{
		const vaults = await this.prisma.vault.findMany({ include: { owner: true } })

		return vaults.map(vault => ({
			id: vault.id,
			chatId: vault.owner.telegram_id,
			currency: vault.currency,
			name: vault.title
		}))
	}

	public async getStatisticsWithEquivalence(equivalenceCurrency: Currency): Promise<Statistics>
	{
		const polls = await this.prisma.poll.findMany({
			orderBy: {
				createdAt: 'asc'
			},
			include: { statuses: { include: { vault: true } } }
		})

		const amounts: any = { EQUIVALENCE: [] };
		const dates: string[] = [];
		const byCurrencySummaries: any[] = [];
		const keySet: Set<string> = new Set();
		for (const poll of polls) {
			const { byCurrency, equivalence, date } = await this.getPollSummary(poll, equivalenceCurrency);
			Object.keys(byCurrency).forEach((key: string) => keySet.add(key));
			dates.push(date);
			amounts['EQUIVALENCE'].push(equivalence.amount);
			byCurrencySummaries.push(byCurrency);
		}
		for(const entry of byCurrencySummaries) {
			for (const key of keySet) {
				if (!amounts[key]) amounts[key] = [];
				amounts[key].push(entry[key] || 0);
			}
		}
		return { amounts, dates };
	}

	public async setValue(column: string, id: number, value: string): Promise<void>
	{
		await this.prisma.vaultStatus.create({
			data: {
				pollId: parseInt(column),
				vaultId: id,
				amount: parseFloat(value)
			}
		})
	}

	public async getUserVaults(telegramId: string, includeDeactivated: boolean = false): Promise<any[]>
	{
		const vaults = await this.prisma.vault.findMany({
			where: {
				owner: {
					telegram_id: telegramId
				},
				...!includeDeactivated ? {
					active: true
				} : {}
			},
			include: {
				statuses: {
					orderBy: {
						poll: {
							createdAt: 'desc'
						}
					}
				}
			}
		})

		return vaults.map(vault => ({
			id: vault.id,
			currency: vault.currency,
			title: vault.title,
			amount: vault.statuses[0]?.amount
		}))
	}

	public async createVault(title: string, currency: Currency, telegramId: string): Promise<any>
	{
		const owner = await this.prisma.user.findFirst({ where: { telegram_id: telegramId } })

		if (!owner)
		{
			throw Error(`User with telegram ID ${telegramId} not found!`)
		}

		return  this.prisma.vault.create({
			data: {
				title,
				currency: currency.toString(),
				ownerId: owner.id
			}
		})
	}

	public async renameVault(id: number, title: string): Promise<void>
	{
		await this.prisma.vault.update({
			where: {
				id
			},
			data: {
				title
			}
		})
	}

	public async changeVaultCurrency(id: number, currency: string): Promise<void>
	{
		await this.prisma.vault.update({
			where: {
				id
			},
			data: {
				currency
			}
		})
	}

	public async changeVaultAmount(id: number, amount: number): Promise<void>
	{
		const status = await this.prisma.vaultStatus.findFirst({
			where: {
				vaultId: id
			},
			orderBy: {
				poll: {
					createdAt: 'desc'
				}
			}
		})

		if (!status)
		{
			throw Error("Cannot find vault status");
		}

		await this.prisma.vaultStatus.update({
			where: {
				id: status.id
			},
			data: {
				amount
			}
		})
	}

	public async changeVaultActiveState(id: number, active: boolean)
	{
		await this.prisma.vault.update({
			where: {
				id
			},
			data: {
				active
			}
		})
	}

	private async getPollSummary(poll: any, equivalenceCurrency: Currency)
	{
		const byCurrency: any = {};
		poll.statuses.forEach((vaultStatus: any) => {
			byCurrency[vaultStatus.vault.currency] = (byCurrency[vaultStatus.vault.currency] || 0) + vaultStatus.amount;
		})

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
			date: poll.createdAt,
			byCurrency,
			equivalence: {
				currency: equivalenceCurrency,
				amount: equivalenceAmount
			}
		};
	}
}

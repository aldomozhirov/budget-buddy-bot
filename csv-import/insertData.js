// insertData.js

const { PrismaClient } = require('../generated/prisma');
const fs = require('fs');
const csv = require('csv-parser');
const prisma = new PrismaClient();

async function main() {
	const filePath = './import.csv';
	const dataRows = [];

	// Read CSV
	await new Promise((resolve, reject) => {
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', row => dataRows.push(row))
			.on('end', resolve)
			.on('error', reject);
	});

	const pollMap = new Map(); // date string => pollId

	for (const row of dataRows) {
		const telegramId = row['Telegram ID'];
		const vaultTitle = row['Source'];
		const currency = row['Currency'];
		const active = row['Active'] === '1';

		// 1. Create or connect user
		const user = await prisma.user.upsert({
			where: { telegram_id: telegramId },
			update: {},
			create: {
				telegram_id: telegramId,
				name: 'Unknown', // Adjust as needed
			},
		});

		// 2. Create vault
		const vault = await prisma.vault.create({
			data: {
				title: vaultTitle,
				currency,
				active,
				ownerId: user.id,
			},
		});

		// 3. Process date columns as polls
		const dateKeys = Object.keys(row).filter(key => /\d{2}\/\d{2}\/\d{4}/.test(key));

		for (const dateStr of dateKeys) {
			const amountStr = row[dateStr];
			const amount = parseFloat(amountStr);

			if (isNaN(amount)) continue;

			// Format date from MM/DD/YYYY to ISO
			const [month, day, year] = dateStr.split('/');
			const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

			let pollId;
			if (pollMap.has(isoDate)) {
				pollId = pollMap.get(isoDate);
			} else {
				const poll = await prisma.poll.create({
					data: {
						createdAt: new Date(isoDate),
					},
				});
				pollId = poll.id;
				pollMap.set(isoDate, pollId);
			}

			// 4. Create vault status
			await prisma.vaultStatus.create({
				data: {
					vaultId: vault.id,
					pollId,
					amount,
				},
			});
		}
	}

	console.log('Data import complete.');
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());

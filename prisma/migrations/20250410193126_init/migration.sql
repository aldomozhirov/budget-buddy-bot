-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "surname" TEXT,
    "telegram_id" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Vault" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vault_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "VaultStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vaultId" INTEGER NOT NULL,
    "pollId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "VaultStatus_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VaultStatus_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegram_id_key" ON "User"("telegram_id");

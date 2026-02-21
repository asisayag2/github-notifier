-- CreateTable
CREATE TABLE "TrackedPR" (
    "id" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "matchReason" TEXT NOT NULL,
    "matchDetails" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mergedAt" TIMESTAMP(3),

    CONSTRAINT "TrackedPR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRChange" (
    "id" TEXT NOT NULL,
    "trackedPRId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "filesChanged" TEXT NOT NULL,
    "diffStats" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedPR_prNumber_key" ON "TrackedPR"("prNumber");

-- AddForeignKey
ALTER TABLE "PRChange" ADD CONSTRAINT "PRChange_trackedPRId_fkey" FOREIGN KEY ("trackedPRId") REFERENCES "TrackedPR"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { db } from "@workspace/db";
import { commKnowledgeBaseTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

export async function listKnowledgeBase(params: {
  companyId?: number | null;
  brandId?: number | null;
  category?: string;
}) {
  const conditions = [eq(commKnowledgeBaseTable.isActive, true)];
  if (params.companyId) conditions.push(eq(commKnowledgeBaseTable.companyId, params.companyId));
  if (params.brandId) conditions.push(eq(commKnowledgeBaseTable.brandId, params.brandId));
  if (params.category) conditions.push(eq(commKnowledgeBaseTable.category, params.category as "faq"));

  return db.select().from(commKnowledgeBaseTable)
    .where(and(...conditions))
    .orderBy(desc(commKnowledgeBaseTable.updatedAt));
}

export async function createKbArticle(data: {
  title: string;
  content: string;
  category?: string;
  brandId?: number | null;
  tags?: string[];
  companyId?: number | null;
}) {
  const [row] = await db.insert(commKnowledgeBaseTable).values({
    title: data.title,
    content: data.content,
    category: (data.category ?? "faq") as "faq",
    brandId: data.brandId ?? null,
    tags: data.tags ?? [],
    companyId: data.companyId ?? null,
  }).returning();
  return row!;
}

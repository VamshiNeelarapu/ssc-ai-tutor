import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import SyllabusNode from "@/models/SyllabusNode";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { seedSyllabus } from "@/lib/syllabus-seed";
import { ISyllabusNode } from "@/models/SyllabusNode";

const CreateNodeSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  parentId: z.string().nullable().optional(),
  nodeType: z.enum(["subject", "section", "topic"]),
});

interface TreeNode {
  id: string;
  name: string;
  slug: string;
  nodeType: string;
  order: number;
  description?: string;
  children: TreeNode[];
}

function buildTree(nodes: ISyllabusNode[], parentId: string | null = null): TreeNode[] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map((node) => ({
      id: node._id.toString(),
      name: node.name,
      slug: node.slug,
      nodeType: node.nodeType,
      order: node.order,
      description: node.description,
      children: buildTree(nodes, node._id.toString()),
    }));
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request as unknown as Request);

    const body = await request.json();
    const validation = CreateNodeSchema.safeParse(body);
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    const { name, parentId = null, nodeType } = validation.data;

    await connectToDatabase();

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const siblings = await SyllabusNode.find({ parentId: parentId ?? null });
    const order = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;

    const node = await SyllabusNode.create({ name, slug, parentId: parentId ?? null, nodeType, order });
    return apiSuccess({ id: node._id.toString(), name: node.name, slug: node.slug, nodeType: node.nodeType });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request as unknown as Request);

    await connectToDatabase();

    const count = await SyllabusNode.countDocuments();
    if (count === 0) {
      await seedSyllabus();
    }

    const nodes = await SyllabusNode.find({}).sort({ order: 1 });
    const tree = buildTree(nodes, null);

    return apiSuccess(tree);
  } catch (error) {
    return handleApiError(error);
  }
}

import connectToDatabase from "./db";
import SyllabusNode from "@/models/SyllabusNode";
import { SSC_SYLLABUS } from "./ssc-syllabus-data";

export interface SyllabusItem {
  name: string;
  slug: string;
  nodeType: "subject" | "section" | "topic";
  children?: SyllabusItem[];
  description?: string;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[&]/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function seedNode(
  item: SyllabusItem,
  parentId: string | null,
  order: number
): Promise<string> {
  const existing = await SyllabusNode.findOne({ slug: item.slug });
  let nodeId: string;

  if (existing) {
    nodeId = existing._id.toString();
  } else {
    const node = await SyllabusNode.create({
      name: item.name,
      slug: item.slug,
      parentId: parentId,
      nodeType: item.nodeType,
      order,
      description: item.description,
    });
    nodeId = node._id.toString();
  }

  if (item.children) {
    for (let i = 0; i < item.children.length; i++) {
      await seedNode(item.children[i], nodeId, i);
    }
  }

  return nodeId;
}

export async function seedSyllabus(): Promise<void> {
  await connectToDatabase();

  const count = await SyllabusNode.countDocuments();
  if (count > 0) {
    return; // Already seeded
  }

  console.log("Seeding syllabus hierarchy...");

  for (let i = 0; i < SSC_SYLLABUS.length; i++) {
    await seedNode(SSC_SYLLABUS[i], null, i);
  }

  console.log("Syllabus seeding complete.");
}

export { toSlug };
export default seedSyllabus;

import seedSyllabus from "../lib/syllabus-seed";

async function main() {
  try {
    await seedSyllabus();
    console.log("Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

main();

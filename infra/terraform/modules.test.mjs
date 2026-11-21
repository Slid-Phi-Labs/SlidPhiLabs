import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

test("the four modules name the resources and the region is us-east-2", () => {
  const main = readFileSync(join(dir, "main.tf"), "utf8");
  assert.match(main, /us-east-2/);
  const expect = [
    ["modules/ecr/main.tf", "aws_ecr_repository"],
    ["modules/ecs/main.tf", "aws_ecs_task_definition"],
    ["modules/rds/main.tf", "aws_db_instance"],
    ["modules/elasticache/main.tf", "aws_elasticache_cluster"],
  ];
  for (const [file, resource] of expect) {
    assert.match(readFileSync(join(dir, file), "utf8"), new RegExp(resource));
  }
});

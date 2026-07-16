"use strict";

const fs = require("fs");
const path = require("path");

const PROMPT_PATH = path.join(
  __dirname,
  "prompts",
  "workflow.system.txt"
);

const PROFESSIONAL_PROMPT_PATH = path.join(
  __dirname,
  "prompts",
  "workflow-professional.system.txt"
);

const JOB_MASTER_PATH = path.join(
  __dirname,
  "workflow-masters",
  "workflow-job-master.json"
);

const OPENAI_URL =
  "https://api.openai.com/v1/responses";

const ALLOWED_CHANNELS = new Set([
  "general",
  "accounting",
  "sales",
  "event",
  "manufacture"
]);

const ALLOWED_PHASES = new Set([
  "prepare",
  "execute",
  "deadline",
  "review",
  "send",
  "hold",
  "warning"
]);

const ALLOWED_PRIORITIES = new Set([
  "high",
  "medium",
  "low"
]);

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });

  res.end(body);
}

function cleanUrl(req) {
  return String(req.url || "")
    .split("?")[0]
    .replace(/\/+$/, "");
}

function safeText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let byteLength = 0;
    const chunks = [];
    let finished = false;

    function rejectOnce(error) {
      if (finished) {
        return;
      }

      finished = true;
      reject(error);
    }

    req.on("data", chunk => {
      if (finished) {
        return;
      }

      byteLength += chunk.length;

      if (byteLength > maxBytes) {
        const error = new Error(
          "入力内容が大きすぎます。"
        );

        error.statusCode = 413;
        rejectOnce(error);
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      if (finished) {
        return;
      }

      finished = true;

      try {
        const bodyText = Buffer
          .concat(chunks)
          .toString("utf8");

        resolve(
          JSON.parse(bodyText || "{}")
        );
      }
      catch {
        const error = new Error(
          "JSON入力を解析できません。"
        );

        error.statusCode = 400;
        reject(error);
      }
    });

    req.on("error", rejectOnce);
  });
}

function normalizeAllowedItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();

  return value
    .map(item => ({
      id: safeText(
        item && (
          item.id ??
          item.department_id ??
          item.person_id ??
          item.user_id ??
          item.calendar_user_id
        ),
        100
      ),

      name: safeText(
        item && (
          item.name ??
          item.department_name ??
          item.person_name ??
          item.user_name ??
          item.calendar_user_name
        ),
        100
      )
    }))
    .filter(item => item.id && item.name)
    .filter(item => {
      const key = item.id + "|" + item.name;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 200);
}

function resolveAllowedItem(id, name, items) {
  const cleanId = safeText(id, 100);
  const cleanName = safeText(name, 100);

  if (cleanId) {
    const idMatch =
      items.find(item => item.id === cleanId);

    if (idMatch) {
      return idMatch;
    }
  }

  if (cleanName) {
    const nameMatch =
      items.find(item => item.name === cleanName);

    if (nameMatch) {
      return nameMatch;
    }
  }

  return null;
}

function configuredModel() {
  return (
    safeText(
      process.env.OPENAI_CALENDAR_MODEL,
      100
    ) ||
    safeText(
      process.env.OPENAI_MODEL,
      100
    ) ||
    "gpt-4.1-mini"
  );
}

function apiKey() {
  return safeText(
    process.env.OPENAI_API_KEY,
    2000
  );
}

function loadPrompt() {
  if (!fs.existsSync(PROMPT_PATH)) {
    const error = new Error(
      "業務フロープロンプトが見つかりません。"
    );

    error.statusCode = 500;
    throw error;
  }

  const prompt = fs
    .readFileSync(PROMPT_PATH, "utf8")
    .trim();

  if (!prompt) {
    const error = new Error(
      "業務フロープロンプトが空です。"
    );

    error.statusCode = 500;
    throw error;
  }

  const professionalPrompt =
    fs.existsSync(PROFESSIONAL_PROMPT_PATH)
      ? fs
        .readFileSync(
          PROFESSIONAL_PROMPT_PATH,
          "utf8"
        )
        .trim()
      : "";

  const jobMasterText =
    fs.existsSync(JOB_MASTER_PATH)
      ? fs
        .readFileSync(
          JOB_MASTER_PATH,
          "utf8"
        )
        .trim()
      : "";

  return [
    prompt,
    professionalPrompt,
    jobMasterText
      ? [
          "【職務分類マスタJSON】",
          jobMasterText
        ].join("\n")
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function outputSchema() {
  return {
    type: "object",
    additionalProperties: false,

    required: [
      "summary",
      "tasks",
      "warnings"
    ],

    properties: {
      summary: {
        type: "string"
      },

      warnings: {
        type: "array",
        items: {
          type: "string"
        }
      },

      tasks: {
        type: "array",
        maxItems: 200,

        items: {
          type: "object",
          additionalProperties: false,

          required: [
            "title",
            "date",
            "department_id",
            "department_name",
            "person_id",
            "person_name",
            "calendar_user_id",
            "calendar_user_name",
            "channel",
            "phase",
            "priority",
            "source_text",
            "reason",
            "needs_review",
            "job_code",
            "major_category",
            "middle_category",
            "minor_category",
            "recurrence",
            "rule_key"
          ],

          properties: {
            title: {
              type: "string"
            },

            date: {
              type: "string"
            },

            department_id: {
              type: "string"
            },

            department_name: {
              type: "string"
            },

            person_id: {
              type: "string"
            },

            person_name: {
              type: "string"
            },

            calendar_user_id: {
              type: "string"
            },

            calendar_user_name: {
              type: "string"
            },

            channel: {
              type: "string",
              enum: [
                "general",
                "accounting",
                "sales",
                "event",
                "manufacture"
              ]
            },

            phase: {
              type: "string",
              enum: [
                "prepare",
                "execute",
                "deadline",
                "review",
                "send",
                "hold",
                "warning"
              ]
            },

            priority: {
              type: "string",
              enum: [
                "high",
                "medium",
                "low"
              ]
            },

            source_text: {
              type: "string"
            },

            reason: {
              type: "string"
            },

            needs_review: {
              type: "boolean"
            },

            job_code: {
              type: "string"
            },

            major_category: {
              type: "string"
            },

            middle_category: {
              type: "string"
            },

            minor_category: {
              type: "string"
            },

            recurrence: {
              type: "string",
              enum: [
                "none",
                "daily",
                "weekly",
                "monthly",
                "yearly"
              ]
            },

            rule_key: {
              type: "string"
            }
          }
        }
      }
    }
  };
}

function extractOutputText(responseJson) {
  if (
    responseJson &&
    typeof responseJson.output_text === "string" &&
    responseJson.output_text.trim()
  ) {
    return responseJson.output_text.trim();
  }

  const outputTexts = [];

  const outputs =
    responseJson &&
    Array.isArray(responseJson.output)
      ? responseJson.output
      : [];

  for (const output of outputs) {
    const contents =
      output &&
      Array.isArray(output.content)
        ? output.content
        : [];

    for (const content of contents) {
      if (
        content &&
        content.type === "output_text" &&
        typeof content.text === "string" &&
        content.text.trim()
      ) {
        outputTexts.push(content.text.trim());
      }
    }
  }

  return outputTexts.join("\n").trim();
}

function normalizeDate(value, year) {
  const dateText = safeText(value, 20);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return "";
  }

  const date = new Date(
    dateText + "T00:00:00"
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const normalized = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");

  if (
    normalized !== dateText ||
    date.getFullYear() !== year
  ) {
    return "";
  }

  return dateText;
}

function normalizeResult(parsed, context) {
  const sourceTasks =
    parsed &&
    Array.isArray(parsed.tasks)
      ? parsed.tasks
      : [];

  const tasks = sourceTasks
    .slice(0, 200)
    .map(source => {
      const department =
        resolveAllowedItem(
          source.department_id,
          source.department_name,
          context.departments
        );

      const person =
        resolveAllowedItem(
          source.person_id,
          source.person_name,
          context.people
        );

      let calendarUser =
        resolveAllowedItem(
          source.calendar_user_id,
          source.calendar_user_name,
          context.calendarUsers
        );

      if (!calendarUser && person) {
        calendarUser =
          context.calendarUsers.find(
            user => user.name === person.name
          ) || null;
      }

      const title =
        safeText(source.title, 300);

      const date =
        normalizeDate(
          source.date,
          context.year
        );

      const channel =
        ALLOWED_CHANNELS.has(source.channel)
          ? source.channel
          : "general";

      const phase =
        ALLOWED_PHASES.has(source.phase)
          ? source.phase
          : "execute";

      const priority =
        ALLOWED_PRIORITIES.has(source.priority)
          ? source.priority
          : "medium";

      const departmentRequired =
        context.departments.length > 0;

      const needsReview =
        Boolean(source.needs_review) ||
        !title ||
        !date ||
        !calendarUser ||
        (
          departmentRequired &&
          !department
        );

      return {
        title,
        date,

        department_id:
          department
            ? department.id
            : "",

        department_name:
          department
            ? department.name
            : "",

        person_id:
          person
            ? person.id
            : "",

        person_name:
          person
            ? person.name
            : "",

        calendar_user_id:
          calendarUser
            ? calendarUser.id
            : "",

        calendar_user_name:
          calendarUser
            ? calendarUser.name
            : "",

        channel,
        phase,
        priority,

        source_text:
          safeText(
            source.source_text,
            1000
          ),

        reason:
          safeText(
            source.reason,
            1000
          ),

        needs_review:
          needsReview,

        job_code:
          safeText(
            source.job_code,
            100
          ) || "general_workflow",

        major_category:
          safeText(
            source.major_category,
            200
          ),

        middle_category:
          safeText(
            source.middle_category,
            200
          ),

        minor_category:
          safeText(
            source.minor_category,
            200
          ),

        recurrence:
          [
            "none",
            "daily",
            "weekly",
            "monthly",
            "yearly"
          ].includes(source.recurrence)
            ? source.recurrence
            : "none",

        rule_key:
          safeText(
            source.rule_key,
            200
          )
      };
    })
    .filter(task => task.title);

  const warnings =
    parsed &&
    Array.isArray(parsed.warnings)
      ? parsed.warnings
        .map(item =>
          safeText(item, 500)
        )
        .filter(Boolean)
        .slice(0, 50)
      : [];

  return {
    summary:
      safeText(
        parsed && parsed.summary,
        2000
      ),

    tasks,
    warnings
  };
}

async function callOpenAi(context) {
  const key = apiKey();

  if (!key) {
    const error = new Error(
      "OPENAI_API_KEYがサーバー環境に読み込まれていません。"
    );

    error.statusCode = 500;
    throw error;
  }

  if (typeof fetch !== "function") {
    const error = new Error(
      "現在のNode.jsではfetchを使用できません。"
    );

    error.statusCode = 500;
    throw error;
  }

  const model = configuredModel();
  const prompt = loadPrompt();

  const userPayload = {
    target_year:
      context.year,

    company:
      context.company,

    workflow_text:
      context.workflowText,

    allowed_departments:
      context.departments,

    allowed_people:
      context.people,

    allowed_calendar_users:
      context.calendarUsers,

    allowed_channels: [
      {
        id: "general",
        name: "全般"
      },
      {
        id: "accounting",
        name: "総務・経理"
      },
      {
        id: "sales",
        name: "営業・商談"
      },
      {
        id: "event",
        name: "出店・イベント"
      },
      {
        id: "manufacture",
        name: "製造"
      }
    ]
  };

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      120000
    );

  try {
    const response = await fetch(
      OPENAI_URL,
      {
        method: "POST",

        signal:
          controller.signal,

        headers: {
          "Authorization":
            "Bearer " + key,

          "Content-Type":
            "application/json; charset=utf-8"
        },

        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: 6000,

          instructions:
            prompt,

          input:
            JSON.stringify(
              userPayload,
              null,
              2
            ),

          text: {
            format: {
              type: "json_schema",
              name:
                "calendar_workflow_plan",
              strict: true,
              schema:
                outputSchema()
            }
          }
        })
      }
    );

    const raw =
      await response.text();

    let responseJson = null;

    try {
      responseJson =
        JSON.parse(raw);
    }
    catch {
      responseJson = null;
    }

    if (!response.ok) {
      const apiMessage =
        responseJson &&
        responseJson.error &&
        responseJson.error.message
          ? safeText(
              responseJson.error.message,
              1000
            )
          : "";

      const error = new Error(
        apiMessage ||
        "OpenAI APIエラー: HTTP " +
        response.status
      );

      error.statusCode = 502;
      throw error;
    }

    const outputText =
      extractOutputText(
        responseJson
      );

    if (!outputText) {
      const error = new Error(
        "OpenAI応答に解析結果がありません。"
      );

      error.statusCode = 502;
      throw error;
    }

    let parsed = null;

    try {
      parsed =
        JSON.parse(outputText);
    }
    catch {
      const error = new Error(
        "OpenAI応答をJSONとして解析できませんでした。"
      );

      error.statusCode = 502;
      throw error;
    }

    return {
      model,

      result:
        normalizeResult(
          parsed,
          context
        )
    };
  }
  catch (error) {
    if (
      error &&
      error.name === "AbortError"
    ) {
      const timeoutError =
        new Error(
          "OpenAI解析がタイムアウトしました。"
        );

      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  }
  finally {
    clearTimeout(timeout);
  }
}

async function handleCalendarWorkflowRoutes(
  req,
  res
) {
  const urlPath = cleanUrl(req);

  if (
    req.method === "GET" &&
    urlPath ===
      "/api/calendar/workflow/status"
  ) {
    sendJson(res, 200, {
      ok: true,

      route_ready:
        true,

      openai_key_configured:
        Boolean(apiKey()),

      model:
        configuredModel(),

      prompt_ready:
        fs.existsSync(PROMPT_PATH)
    });

    return true;
  }

  if (
    req.method !== "POST" ||
    urlPath !==
      "/api/calendar/workflow/analyze"
  ) {
    return false;
  }

  try {
    const body =
      await readJsonBody(req);

    const year =
      Number(
        body.target_year ??
        body.year
      );

    const workflowText =
      safeText(
        body.workflow_text ??
        body.text,
        30000
      );

    if (
      !Number.isInteger(year) ||
      year < 2020 ||
      year > 2100
    ) {
      const error = new Error(
        "対象年が不正です。"
      );

      error.statusCode = 400;
      throw error;
    }

    if (!workflowText) {
      const error = new Error(
        "業務内容を入力してください。"
      );

      error.statusCode = 400;
      throw error;
    }

    const calendarUsers =
      normalizeAllowedItems(
        body.calendar_users
      );

    if (!calendarUsers.length) {
      const error = new Error(
        "カレンダー担当者が登録されていません。"
      );

      error.statusCode = 400;
      throw error;
    }

    const context = {
      year,
      workflowText,

      company:
        body.company &&
        typeof body.company === "object"
          ? body.company
          : null,

      departments:
        normalizeAllowedItems(
          body.departments
        ),

      people:
        normalizeAllowedItems(
          body.people
        ),

      calendarUsers
    };

    const analyzed =
      await callOpenAi(context);

    sendJson(res, 200, {
      ok: true,

      model:
        analyzed.model,

      summary:
        analyzed.result.summary,

      tasks:
        analyzed.result.tasks,

      warnings:
        analyzed.result.warnings
    });

    return true;
  }
  catch (error) {
    console.error(
      "[CALENDAR_WORKFLOW_OPENAI]",
      error
    );

    sendJson(
      res,
      error &&
      error.statusCode
        ? error.statusCode
        : 500,
      {
        ok: false,

        error:
          error &&
          error.message
            ? error.message
            : "業務フローAI解析に失敗しました。"
      }
    );

    return true;
  }
}

module.exports = {
  handleCalendarWorkflowRoutes
};

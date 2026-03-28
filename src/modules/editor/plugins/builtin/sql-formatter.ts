/**
 * @module editor/plugins/builtin/sql-formatter
 *
 * Basic SQL formatting / keyword uppercasing.
 */
import type { ExtendedEditorPlugin } from "../types";

const SQL_KEYWORDS = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL",
    "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE",
    "TABLE", "ALTER", "DROP", "INDEX", "VIEW", "JOIN", "INNER", "LEFT",
    "RIGHT", "OUTER", "FULL", "CROSS", "ON", "AS", "ORDER", "BY",
    "GROUP", "HAVING", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT",
    "EXISTS", "BETWEEN", "LIKE", "CASE", "WHEN", "THEN", "ELSE", "END",
    "ASC", "DESC", "COUNT", "SUM", "AVG", "MIN", "MAX", "PRIMARY",
    "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT", "DEFAULT", "CHECK",
    "UNIQUE", "AUTO_INCREMENT", "CASCADE", "TRUNCATE", "BEGIN",
    "COMMIT", "ROLLBACK", "TRANSACTION", "GRANT", "REVOKE",
];

const NEWLINE_KEYWORDS = new Set([
    "SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "GROUP BY",
    "HAVING", "LIMIT", "OFFSET", "JOIN", "INNER JOIN", "LEFT JOIN",
    "RIGHT JOIN", "OUTER JOIN", "FULL JOIN", "CROSS JOIN", "ON",
    "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE", "UNION",
]);

function formatSQL(sql: string): string {
    // Uppercase keywords
    let formatted = sql;
    for (const kw of SQL_KEYWORDS) {
        const regex = new RegExp(`\\b${kw}\\b`, "gi");
        formatted = formatted.replace(regex, kw);
    }

    // Add newlines before major clauses
    for (const kw of NEWLINE_KEYWORDS) {
        const regex = new RegExp(`\\s+${kw}\\b`, "gi");
        formatted = formatted.replace(regex, `\n${kw}`);
    }

    // Indent after SELECT, SET, VALUES
    const lines = formatted.split("\n");
    const result: string[] = [];
    let indent = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith(")")) indent = Math.max(0, indent - 1);

        result.push("  ".repeat(indent) + trimmed);

        if (trimmed.endsWith("(")) indent++;
    }

    return result.join("\n");
}

export function createSqlFormatterPlugin(): ExtendedEditorPlugin {
    return {
        id: "sql-formatter",
        name: "SQL Formatter",
        version: "1.0.0",
        description: "Formats SQL queries with proper keyword casing and indentation",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("sql.format", () => {
                const { language } = api.getFileInfo();
                if (!language.toLowerCase().includes("sql")) return;
                const content = api.getContent();
                api.setContent(formatSQL(content));
            });

            api.addContextMenuItem({
                label: "Format SQL",
                action: () => api.executeCommand("sql.format"),
                priority: 52,
            });
        },
    };
}

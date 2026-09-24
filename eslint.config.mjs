import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        // .claude/ — рабочие деревья агентов со своими .next и node_modules,
        // .remember/ — локальные заметки инструментов; ни то ни другое не код
        // проекта, а без исключения хук pre-commit линтит их сборки.
        ignores: ["src/generated/**/*", ".claude/**", ".remember/**"]
    }
];

export default eslintConfig;
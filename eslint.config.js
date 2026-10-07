import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['node_modules/**','.venv-ai/**','.venv-qwen/**','.cache/**','data/**','public/**']}, ...tseslint.configs.recommended, {rules:{'@typescript-eslint/no-explicit-any':'off'}});

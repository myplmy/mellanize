import { defineConfig } from 'vite';

// GitHub Pages 프로젝트 사이트: https://<user>.github.io/mellanize/
// base 를 리포명으로 맞춰야 자산 경로가 깨지지 않는다.
export default defineConfig({
  base: '/mellanize/',
});

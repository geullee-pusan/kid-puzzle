import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 주소로 뽑는다. 하위 폴더 주소(GitHub Pages)에서도 열린다.
  base: './',
  build: {
    rollupOptions: {
      input: {
        // 앱(아이가 쓰는 화면)
        main: resolve(import.meta.dirname, 'index.html'),
        // 점검 화면(부모·개발용): 기록 전송 설정, 기록 보기, 오프라인 상태
        check: resolve(import.meta.dirname, 'check.html'),
      },
    },
  },
});

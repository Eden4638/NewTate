const A="data:image/webp;base64,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";export{A as default};

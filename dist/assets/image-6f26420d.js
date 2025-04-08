const A="data:image/webp;base64,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";export{A as default};

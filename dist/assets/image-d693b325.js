const A="data:image/webp;base64,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";export{A as default};

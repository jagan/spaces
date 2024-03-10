const faviconCheck = () => {
    const favicon = document.querySelector("link[rel='icon']");
    return favicon ? favicon.href : null;
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkFavicon') {
        const faviconUrl = faviconCheck();
        sendResponse({ faviconUrl });
    }
});

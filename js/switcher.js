/* global chrome, spacesRenderer  */

(() => {
    // Wrapper function for chrome.runtime.sendMessage with error handling
    function sendMessageSafely(message, callback) {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Message send error (background script may be unavailable):', chrome.runtime.lastError.message);
                if (callback) callback(null);
            } else {
                if (callback) callback(response);
            }
        });
    }

    function getSelectedSpace() {
        return document.querySelector('.space.selected');
    }

    function handleSwitchAction(selectedSpaceEl) {
        sendMessageSafely({
            action: 'switchToSpace',
            sessionId: selectedSpaceEl.getAttribute('data-sessionId'),
            windowId: selectedSpaceEl.getAttribute('data-windowId'),
        });
    }

    function handleCloseAction() {
        sendMessageSafely({
            action: 'requestClose',
        });
    }

    function getSwitchKeycodes(callback) {
        sendMessageSafely({ action: 'requestHotkeys' }, commands => {
            if (!commands) {
                console.log('Could not get hotkeys from background script');
                callback({
                    primaryModifier: null,
                    secondaryModifier: null,
                    mainKeyCode: null,
                });
                return;
            }

            // eslint-disable-next-line no-console
            console.dir(commands);

            const commandStr = commands.switchCode;
            
            if (!commandStr) {
                callback({
                    primaryModifier: null,
                    secondaryModifier: null,
                    mainKeyCode: null,
                });
                return;
            }

            const keyStrArray = commandStr.split('+');

            // get keyStr of primary modifier
            const primaryModifier = keyStrArray[0];

            // get keyStr of secondary modifier
            const secondaryModifier =
                keyStrArray.length === 3 ? keyStrArray[1] : false;

            // get keycode of main key (last in array)
            const curStr = keyStrArray[keyStrArray.length - 1];
            let mainKeyCode;

            // TODO: There's others. Period. Up Arrow etc.
            if (curStr === 'Space') {
                mainKeyCode = 32;
            } else {
                mainKeyCode = curStr.toUpperCase().charCodeAt();
            }

            callback({
                primaryModifier,
                secondaryModifier,
                mainKeyCode,
            });
        });
    }

    function addEventListeners() {
        document.getElementById('spaceSelectForm').onsubmit = e => {
            e.preventDefault();
            handleSwitchAction(getSelectedSpace());
        };

        const allSpaceEls = document.querySelectorAll('.space');
        Array.prototype.forEach.call(allSpaceEls, el => {
            // eslint-disable-next-line no-param-reassign
            el.onclick = () => {
                handleSwitchAction(el);
            };
        });

        // Here lies some pretty hacky stuff. Yus! Hax!
        getSwitchKeycodes(() => {
            const body = document.querySelector('body');

            body.onkeyup = e => {
                // listen for escape key
                if (e.keyCode === 27) {
                    handleCloseAction();
                }
            };
        });
    }

    window.onload = () => {
        sendMessageSafely({ action: 'requestAllSpaces' }, spaces => {
            if (!spaces) {
                console.log('Could not get spaces from background script');
                return;
            }
            spacesRenderer.initialise(8, true);
            spacesRenderer.renderSpaces(spaces);
            addEventListeners();
        });
    };
})();

/*
    Function to set up a system tray menu with options specific to the window mode.
    This function checks if the application is running in window mode, and if so,
    it defines the tray menu items and sets up the tray accordingly.
*/
function setTray() {
    // Tray menu is only available in window mode
    if (NL_MODE != "window") {
        console.log("INFO: Tray menu is only available in the window mode.");
        return;
    }

    // Define tray menu items
    let tray = {
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            { id: "VERSION", text: "Get version" },
            { id: "SEP", text: "-" },
            { id: "QUIT", text: "Quit" }
        ]
    };

    // Set the tray menu
    Neutralino.os.setTray(tray);
}

/*
    Function to handle click events on the tray menu items.
    This function performs different actions based on the clicked item's ID,
    such as displaying version information or exiting the application.
*/
function onTrayMenuItemClicked(event) {
    switch (event.detail.id) {
        case "VERSION":
            // Display version information
            Neutralino.os.showMessageBox("Version information",
                `Neutralinojs server: v${NL_VERSION} | Neutralinojs client: v${NL_CVERSION}`);
            break;
        case "QUIT":
            // Exit the application
            Neutralino.app.exit();
            break;
    }
}

/*
    Function to handle the window close event by gracefully exiting the Neutralino application.
*/
function onWindowClose() {
    Neutralino.app.exit();
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

// Conditional initialization: Set up system tray if not running on macOS
if (NL_OS != "Darwin") { // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
}



// app/assets/js/main.js

let huntGameDirPath = ''; // Variable to store the selected game directory path

// Other paths derived from huntGameDirPath
let huntBinWin64DirPath = '';
let huntGameExeFilePath = '';
let easyAntiCheatPath = '';
let EACSettingsFilePath = '';

// Paths for internal config and data
let internalDirPath = '';
let internalDataDirPath = '';
let internalBackupDirPath = '';

// vars
let modeSelection = '';
let cleanHuntGameExeDirPath = '';
let cleanHuntGameExeFilePath = '';
let skipCleanCopyOptions = false;
let cleanCopyExists = false;
let useExistingCleanCopy = false;
let aliasExeName = '';
let aliasExePath = '';
let aliasDeployedExePath = '';
let setupDone = false;
let internalConfig = '';

async function isElevated() {
    try {
        const output = await Neutralino.os.execCommand('net session');
        if (output.stdOut.includes('Access is denied')) {
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
}

// Restart the application with elevated permissions
async function restartElevated() {
    try {
        await Neutralino.os.execCommand('powershell -Command "Start-Process neutralino-win -Verb runAs"');
        showMessage('Application restarted with elevated permissions.');
        Neutralino.app.exit();
    } catch (error) {
        showMessage('Failed to restart with elevated permissions.');
        console.error('Failed to restart with elevated permissions:', error);
    }
}

// Show message on UI
function showMessage(message, isError = false) {
    const messageContainer = document.getElementById('feedbackMessage');
    messageContainer.innerHTML = `<p style="color: ${isError ? 'red' : 'lime'};">${message}</p>`;
}

// Function to open a directory dialog and save the path to huntGameDirPath
async function selectDirectory() {
    try {
        // Ensure the application has elevated permissions
        const elevated = await isElevated();
        if (!elevated) {
            showMessage('Requesting elevated permissions...');
            await restartElevated();
            return; // Exit current function as the application will restart
        }

        // Show the open dialog
        let response = await Neutralino.os.showFolderDialog('Select Hunt Showdown Game Directory');

        if (response) {
            huntGameDirPath = response;
            showMessage(`Selected game directory path: ${huntGameDirPath}`);

            // Set derived paths
            setDerivedPaths();

            // Verify paths
            await verifyPaths();

            // Update the UI after verification
            updateUIAfterVerification();
        }
    } catch (error) {
        showMessage('Error selecting directory.', true);
        console.error('Error selecting directory:', error);
    }
}

function setDerivedPaths() {
    // folders:
    huntBinWin64DirPath = `${huntGameDirPath}/bin/win_x64`;
    easyAntiCheatPath = `${huntGameDirPath}/EasyAntiCheat`;
    internalDirPath = `${huntGameDirPath}/liquorfreestyle`;
    internalDataDirPath = `${internalDirPath}/data`;
    internalBackupDirPath = `${internalDirPath}/backups`;

    // files:
    huntGameExeFilePath = `${huntBinWin64DirPath}/HuntGame.exe`;
    EACSettingsFilePath = `${easyAntiCheatPath}/Settings.json`;

    // Clean copy paths
    cleanHuntGameExeDirPath = `${internalDataDirPath}/cleanHuntGameCopy`;
    cleanHuntGameExeFilePath = `${cleanHuntGameExeDirPath}/HuntGame.exe`;
}

async function verifyPaths() {
    try {
        showMessage('Verifying paths...');
        await checkDirectoryExists(huntBinWin64DirPath, 'huntBinWin64DirPath');
        await checkFileExists(huntGameExeFilePath, 'huntGameExeFilePath');
        await checkDirectoryExists(internalDirPath, 'internalDirPath', true);
        await checkDirectoryExists(internalDataDirPath, 'internalDataDirPath', true);
        await checkDirectoryExists(internalBackupDirPath, 'internalBackupDirPath', true);
        await checkDirectoryExists(cleanHuntGameExeDirPath, 'cleanHuntGameExeDirPath', true);
        await checkDirectoryExists(easyAntiCheatPath, 'easyAntiCheatPath');
        await checkFileExists(EACSettingsFilePath, 'EACSettingsFilePath');
        showMessage('Finished verifying paths.');
    } catch (error) {
        showMessage('Error verifying paths.', true);
        console.error('Error verifying paths:', error);
    }
}

async function checkDirectoryExists(path, pathName, createIfNotExists = false) {
    try {
        showMessage(`Checking directory: ${path}`);
        await Neutralino.filesystem.readDirectory(path);
        showMessage(`Directory ${pathName} exists: ${path}`);
    } catch (error) {
        if (createIfNotExists) {
            try {
                await Neutralino.filesystem.createDirectory(path);
                showMessage(`Directory ${pathName} created: ${path}`);
            } catch (creationError) {
                showMessage(`Error creating directory ${pathName}: ${path}`, true);
                console.error(`Error creating directory ${pathName}: ${path}`, creationError);
            }
        } else {
            showMessage(`Directory ${pathName} does not exist: ${path}`, true);
            console.error(`Directory ${pathName} does not exist: ${path}`, error);
        }
    }
}

// Adjusted checkFileExists to return a boolean value
async function checkFileExists(path, pathName) {
    try {
        showMessage(`Checking file: ${path}`);
        let stats = await Neutralino.filesystem.getStats(path);
        if (stats) {
            showMessage(`File ${pathName} exists: ${path}`);
            return true;
        } else {
            showMessage(`File ${pathName} does not exist: ${path}`, true);
            return false;
        }
    } catch (error) {
        showMessage(`File ${pathName} does not exist: ${path}`, true);
        console.error(`File ${pathName} does not exist: ${path}`, error);
        return false;
    }
}

function updateUIAfterVerification() {
    const verificationMessage = document.getElementById('verificationMessage');
    const buttonsContainer = document.getElementById('buttonsContainer');
    verificationMessage.innerHTML = `
        <h2>Initialization Success</h2>
        <ul class="verification-list">
            <li><strong>Hunt Bin Win64 Dir Path:</strong> ${huntBinWin64DirPath}</li>
            <li><strong>Hunt Game Exe File Path:</strong> ${huntGameExeFilePath}</li>
            <li><strong>Internal Dir Path:</strong> ${internalDirPath}</li>
            <li><strong>Internal Data Dir Path:</strong> ${internalDataDirPath}</li>
            <li><strong>Internal Backup Dir Path:</strong> ${internalBackupDirPath}</li>
            <li><strong>Easy Anti Cheat Path:</strong> ${easyAntiCheatPath}</li>
            <li><strong>EAC Settings File Path:</strong> ${EACSettingsFilePath}</li>
        </ul>
    `;

    buttonsContainer.innerHTML = `
    <div id="btnRow1">
    <p class="instructions">Use on first install or after game update</p>
        <button id="createBackup">Create Backup</button>
        <button id="runSetup">Run Setup</button>
    </div>
    <div id="btnRow2">
    <p class="instructions">Only run once unless the Game is updated or you Fixed Client Error</p>
        <button id="activateLiquorFreestyle">Activate Liquor Freestyle</button>
    </div>
    <div id="btnRow3">
    <p class="instructions">Running these will require you to also run the activation again to use filters</p>
        <button id="deployCleanHunt">Fix Client Error</button>
        <button id="resetToVanilla">Reset Back to Vanilla</button>
    </div>
    `;

    document.getElementById('createBackup').addEventListener('click', async () => {
        showMessage('Running backup...');
        await createBackup();
    });

    document.getElementById('runSetup').addEventListener('click', async () => {
        showMessage('Running setup...');
        aliasExeName = 'eurotrucks2.exe';
        await runSetup();
    });

    document.getElementById('activateLiquorFreestyle').addEventListener('click', async () => {
        showMessage('Activating Liquor Freestyle...');
        modeSelection = 'brickedUp';
        aliasExeName = 'eurotrucks2.exe';
        await activateLiquorFreestyle();
    });

    document.getElementById('deployCleanHunt').addEventListener('click', async () => {
        showMessage('deploying Clean HuntGame.exe...');
        await deployCleanHuntExe();
    });

    document.getElementById('resetToVanilla').addEventListener('click', async () => {
        showMessage('Resetting back to Vanilla...');
        await resetToVanilla();
    });
}

// setup function for first run and after game updates
async function runSetup() {
    try {
        showMessage('Starting setup...');
        
        // vars
        let errors = '';
        aliasExePath = `${cleanHuntGameExeDirPath}/${aliasExeName}`;
        aliasDeployedExePath = `${huntBinWin64DirPath}/${aliasExeName}`;
        let cleanExeSetupDone = false;
        let cleanAliasSetupDone = false;

        // check if clean exe already exists
        let doesCleanExeExist = await checkFileExists(cleanHuntGameExeFilePath, 'cleanHuntGameExeFilePath', true);

        // check if hunt exe exists 
        let doesOriginalExeExist = await checkFileExists(huntGameExeFilePath, 'huntGameExeFilePath', true);

        // check if alias exists
        let doesAliasExeExist = await checkFileExists(aliasExePath, 'aliasExePath', true);

        // check if deployed alias exists
        let doesdeployedAliasExeExist = await checkFileExists(aliasDeployedExePath, 'aliasDeployedExePath', true);

        if (doesOriginalExeExist) {
            if (doesCleanExeExist) {
                //await Neutralino.filesystem.remove(cleanHuntGameExeFilePath);
                const delCleanHuntCommand = `del "${cleanHuntGameExeFilePath}"`;
                const delCleanHuntCommandOutput = await Neutralino.os.execCommand(delCleanHuntCommand);
                showMessage(`Command output: ${delCleanHuntCommandOutput.stdOut}`);
            }

            // copy the original hunt with console command
            const copyCommand = `copy /B "${huntGameExeFilePath}" "${cleanHuntGameExeFilePath}"`;
            const output = await Neutralino.os.execCommand(copyCommand, { cwd: huntBinWin64DirPath });
            showMessage(`Command output: ${output.stdOut}`);
            showMessage('Cloned a clean copy of HuntGame.exe successfully.');
            cleanExeSetupDone = true;
        } else {
            errors = 'ERROR: original exe file does not exist in win_x64';
            showMessage(errors, true);
        }

        if (cleanExeSetupDone) {
            if (doesAliasExeExist) {
                //await Neutralino.filesystem.remove(aliasExePath);
                const delAliasCommand = `del "${aliasExePath}"`;
                const delAliasCommandOutput = await Neutralino.os.execCommand(delAliasCommand);
                showMessage(`Command output: ${delAliasCommandOutput.stdOut}`);

            }
            if (doesdeployedAliasExeExist) {
                //await Neutralino.filesystem.remove(aliasDeployedExePath);
                const delDeployedAliasCommand = `del "${aliasDeployedExePath}"`;
                const delDeployedAliasCommandOutput = await Neutralino.os.execCommand(delDeployedAliasCommand);
                showMessage(`Command output: ${delDeployedAliasCommandOutput.stdOut}`);
            }
            cleanAliasSetupDone = true;
        }

        if (cleanExeSetupDone && cleanAliasSetupDone) {
           // await deployCleanHuntExe();
        }
        
        showMessage('Setup completed successfully!');
    } catch (error) {
        showMessage('Error during setup.', true);
        console.error('Error during setup:', error);
    }
}

// Activation logic for Liquor Freestyle
async function activateLiquorFreestyle() {
    try {
        await deployAlias();
        await editEACSettingsFile();
        showMessage('Liquor Freestyle activated successfully!');
        //Neutralino.app.exit(); // Exit the application after successful activation
    } catch (error) {
        showMessage('Error activating Liquor Freestyle.', true);
        console.error('Error activating Liquor Freestyle:', error);
    }
}

async function createBackup() {
    try {
        let checkIfHuntExeExists = await checkFileExists(huntGameExeFilePath, 'huntGameExeFilePath', true);

        if (checkIfHuntExeExists) {
            const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
            const backupDir = `${internalBackupDirPath}/${timestamp}`;
            await Neutralino.filesystem.createDirectory(backupDir);

            const backupHuntCommand = `copy /B /V "${huntGameExeFilePath}" "${backupDir}/HuntGame.exe"`;
            const backupHuntOutput = await Neutralino.os.execCommand(backupHuntCommand, { cwd: huntBinWin64DirPath });
            showMessage(`Command output: ${backupHuntOutput.stdOut}`);

            const backupEACCommand = `copy /V "${EACSettingsFilePath}" "${backupDir}/Settings.json"`;
            const backupEACOutput = await Neutralino.os.execCommand(backupEACCommand, { cwd: easyAntiCheatPath });
            showMessage(`Command output: ${backupEACOutput.stdOut}`);

            showMessage('Backup created successfully!');
        } else {
            showMessage('HuntGame.exe does not exist in /bin/win_x64', true);
        }
    } catch (error) {
        showMessage('Error creating backup.', true);
        console.error('Error creating backup:', error);
    }
}

async function editEACSettingsFile() {
    try {
        let settingsContent = await Neutralino.filesystem.readFile(EACSettingsFilePath);
        let settings = JSON.parse(settingsContent);
        settings.executable = `bin\\win_x64\\${aliasExeName}`;

        await Neutralino.filesystem.writeFile(EACSettingsFilePath, JSON.stringify(settings, null, 4));
        showMessage('EAC Settings file edited successfully!');
    } catch (error) {
        showMessage('Error editing EAC Settings file.', true);
        console.error('Error editing EAC Settings file:', error);
    }
}

async function deployCleanHuntExe() {
    const copyHuntCommand = `copy /B /V "${cleanHuntGameExeFilePath}" "${huntGameExeFilePath}"`;
    const copyHuntOutput = await Neutralino.os.execCommand(copyHuntCommand, { cwd: cleanHuntGameExeDirPath });
    showMessage(`Command output: ${copyHuntOutput.stdOut}`);
}

async function deployAlias() {
    const aliasCommand = await Neutralino.os.execCommand(`mklink /H "${aliasExeName}" "HuntGame.exe"`, { cwd: huntBinWin64DirPath });
    showMessage(`Command output: ${aliasCommand.stdOut}`);
}

async function resetToVanilla() {
    try {
        let settingsContent = await Neutralino.filesystem.readFile(EACSettingsFilePath);
        let settings = JSON.parse(settingsContent);
        settings.executable = 'bin\\win_x64\\HuntGame.exe';

        await Neutralino.filesystem.writeFile(EACSettingsFilePath, JSON.stringify(settings, null, 4));
        showMessage('Reset to vanilla successfully!');
    } catch (error) {
        showMessage('Error resetting to vanilla.', true);
        console.error('Error resetting to vanilla:', error);
    }
}

// Copy file function
async function copyFile(source, destination) {
    try {
        await Neutralino.filesystem.copy(source, destination);
        showMessage(`File copied from ${source} to ${destination}`);
    } catch (error) {
        showMessage(`Error copying file from ${source} to ${destination}`, true);
        console.error(`Error copying file from ${source} to ${destination}`, error);
    }
}

// Call the selectDirectory function when the select game directory button is clicked
document.getElementById('selectGameDirButton').addEventListener('click', selectDirectory);

// Example function to demonstrate using the huntGameDirPath variable
function useGameDirPath() {
    if (huntGameDirPath) {
        console.log('Using game directory path:', huntGameDirPath);
        // Implement your logic here using huntGameDirPath
    } else {
        console.log('Game directory path is not set.');
    }
}

// Example usage: Call the useGameDirPath function
useGameDirPath();









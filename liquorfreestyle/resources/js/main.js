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
        const output = await Neutralino.os.execCommand('powershell -Command "Start-Process neutralino-win -Verb runAs"');
        console.log('Application restarted with elevated permissions.');
        Neutralino.app.exit();
    } catch (error) {
        console.error('Failed to restart with elevated permissions:', error);
    }
}



// Function to open a directory dialog and save the path to huntGameDirPath
async function selectDirectory() {
    try {

        // Ensure the application has elevated permissions
        const elevated = await isElevated();
        if (!elevated) {
            console.log('Requesting elevated permissions...');
            await restartElevated();
            return; // Exit current function as the application will restart
        }

        // Show the open dialog
        let response = await Neutralino.os.showFolderDialog('Select Hunt Showdown Game Directory');

        if (response) {
            huntGameDirPath = response;
            console.log('Selected game directory path:', huntGameDirPath);

            // Set derived paths
            setDerivedPaths();

            // Verify paths
            await verifyPaths();

            // Update the UI after verification
            updateUIAfterVerification();
        }
    } catch (error) {
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
        console.log('Verifying paths...');
        await checkDirectoryExists(huntBinWin64DirPath, 'huntBinWin64DirPath');
        console.log('Finished checking huntBinWin64DirPath.');

        await checkFileExists(huntGameExeFilePath, 'huntGameExeFilePath');
        console.log('Finished checking huntGameExeFilePath.');

        await checkDirectoryExists(internalDirPath, 'internalDirPath', true);
        await checkDirectoryExists(internalDataDirPath, 'internalDataDirPath', true);
        await checkDirectoryExists(internalBackupDirPath, 'internalBackupDirPath', true);
        await checkDirectoryExists(cleanHuntGameExeDirPath, 'cleanHuntGameExeDirPath', true);
        console.log('Finished checking internal directories.');

        await checkDirectoryExists(easyAntiCheatPath, 'easyAntiCheatPath');
        console.log('Finished checking easyAntiCheatPath.');

        await checkFileExists(EACSettingsFilePath, 'EACSettingsFilePath');
        console.log('Finished checking EACSettingsFilePath.');
    } catch (error) {
        console.error('Error verifying paths:', error);
    }
}

async function checkDirectoryExists(path, pathName, createIfNotExists = false) {
    try {
        console.log(`Checking directory: ${path}`);
        let stats = await Neutralino.filesystem.readDirectory(path);
        console.log(`Directory ${pathName} exists: ${path}`);
    } catch (error) {
        if (createIfNotExists) {
            try {
                await Neutralino.filesystem.createDirectory(path);
                console.log(`Directory ${pathName} created: ${path}`);
            } catch (creationError) {
                console.error(`Error creating directory ${pathName}: ${path}`, creationError);
            }
        } else {
            console.error(`Directory ${pathName} does not exist: ${path}`, error);
        }
    }
}

// Adjusted checkFileExists to return a boolean value
async function checkFileExists(path, pathName) {
    try {
        console.log(`Checking file: ${path}`);
        let stats = await Neutralino.filesystem.getStats(path);
        if (stats) {
            console.log(`File ${pathName} exists: ${path}`);
            return true;
        } else {
            console.error(`File ${pathName} does not exist: ${path}`);
            return false;
        }
    } catch (error) {
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
        <button id="createBackup">Create Backup</button>
        <button id="runSetup">Run Setup</button>
        <button id="activateLiquorFreestyle">Activate Liquor Freestyle</button>
        <button id="resetToVanilla">Reset Back to Vanilla</button>
    `;

    document.getElementById('activateLiquorFreestyle').addEventListener('click', async () => {
       // document.getElementById('modeButtons').style.display = 'block';
       console.log('Get You Bricked Up Mode activated');
       modeSelection = 'brickedUp';
       aliasExeName = 'eurotrucks2.exe';
       await activateLiquorFreestyle();
    });

    document.getElementById('normalMode').addEventListener('click', async () => {
        console.log('Normal Mode activated');
        modeSelection = 'normal';
        aliasExeName = 'anselintegrationtestapp.exe';
        await activateLiquorFreestyle();
    });

    document.getElementById('brickedUpMode').addEventListener('click', async () => {
        console.log('Get You Bricked Up Mode activated');
        modeSelection = 'brickedUp';
        aliasExeName = 'eurotrucks2.exe';
        await activateLiquorFreestyle();
    });

    document.getElementById('resetToVanilla').addEventListener('click', async () => {
        console.log('Resetting back to Vanilla');
        await resetToVanilla();
    });
    document.getElementById('runSetup').addEventListener('click', async () => {
        aliasExeName = 'eurotrucks2.exe';
        console.log('running setup');
        await runSetup();
    });
    document.getElementById('createBackup').addEventListener('click', async () => {
        console.log('running backup');
        await createBackup();
    });
}

// setup function for first run and after game updates
async function runSetup() {
    try {
        console.log('Starting setup...');

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
                await Neutralino.filesystem.remove(cleanHuntGameExeFilePath);
            }
            // Move the original hunt exe. if it already exists (cleanHuntGameExeFilePath) then replace it
            //await Neutralino.filesystem.move(huntGameExeFilePath, cleanHuntGameExeFilePath);

            // copy the original hunt with console command
            // copy /B source_file_path destination_file_path
            const copyCommand = `copy /B "${huntGameExeFilePath}" "${cleanHuntGameExeFilePath}"`;
            const output = await Neutralino.os.execCommand(copyCommand, { cwd: huntBinWin64DirPath });
            console.log(copyCommand);
            console.log(`Command output: ${output.stdOut}`);
            console.log('Cloned a clean copy of HuntGame.exe successfully.');
            // update state
            cleanExeSetupDone = true;
        } else {
            // track errors with errors var
            // if the original doesn't exist we need to log that
            errors = 'ERROR: original exe file does not exist in win_x64';
        }

        if (cleanExeSetupDone) {
            if (doesAliasExeExist) {
                await Neutralino.filesystem.remove(aliasExePath);
            }
            if (doesdeployedAliasExeExist) {
                await Neutralino.filesystem.remove(aliasDeployedExePath);
            }
            cleanAliasSetupDone = true;
        }


        if (cleanExeSetupDone && cleanAliasSetupDone) {

            await deployCleanHuntExe();
        }




    } catch (error) {
        console.error('Error during setup:', error);
    }
}

// Activation logic for Liquor Freestyle
async function activateLiquorFreestyle() {
    try {

        // deploy alias
        await deployAlias();

        // Edit Settings.json
        await editEACSettingsFile();

        console.log('Liquor Freestyle activated successfully!');
    } catch (error) {
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

           // await copyFile(EACSettingsFilePath, `${backupDir}/Settings.json`);
            //await copyFile(huntGameExeFilePath, `${backupDir}/HuntGame.exe`);
            const backupHuntCommand = `copy /B /V "${huntGameExeFilePath}" "${backupDir}/HuntGame.exe"`;
            const backupHuntOutput = await Neutralino.os.execCommand(backupHuntCommand, { cwd: huntBinWin64DirPath });
            console.log(`Command output: ${backupHuntOutput.stdOut}`);
            //
            const backupEACCommand = `copy /V "${EACSettingsFilePath}" "${backupDir}/Settings.json"`;
            const backupEACOutput = await Neutralino.os.execCommand(backupEACCommand, { cwd: easyAntiCheatPath });
            console.log(`Command output: ${backupEACOutput.stdOut}`);

            console.log('Backup created successfully!');
        } else {
            console.error('HuntGame.exe Does Not Exist in /bin/win_x64')
        }


    } catch (error) {
        console.error('Error creating backup:', error);
    }
}

async function editEACSettingsFile() {
    try {
        let settingsContent = await Neutralino.filesystem.readFile(EACSettingsFilePath);
        let settings = JSON.parse(settingsContent);
        settings.executable = `bin\\win_x64\\${aliasExeName}`;

        await Neutralino.filesystem.writeFile(EACSettingsFilePath, JSON.stringify(settings, null, 4));
        console.log('EAC Settings file edited successfully!');
    } catch (error) {
        console.error('Error editing EAC Settings file:', error);
    }
}

async function deployCleanHuntExe() {
    const copyHuntCommand = `copy /B /V "${cleanHuntGameExeFilePath}" "${huntGameExeFilePath}"`;
    const copyHuntOutput = await Neutralino.os.execCommand(copyHuntCommand, { cwd: cleanHuntGameExeDirPath });
    console.log(copyHuntCommand);
    console.log(`Command output: ${copyHuntOutput.stdOut}`);
}

async function deployAlias() {
    // if aliasExe exists move it to the aliasDeployedExePath
    //let aliasCheck = await checkFileExists(aliasExePath, 'aliasExePath', true);
    // if(aliasCheck){
    //    await Neutralino.filesystem.move(aliasExePath, aliasDeployedExePath);
    // }
    //await Neutralino.filesystem.copy(cleanHuntGameExeFilePath, huntGameExeFilePath);
    const aliasCommand = await Neutralino.os.execCommand(`mklink /H "${aliasExeName}" "HuntGame.exe"`, { cwd: huntBinWin64DirPath });
    console.log(`Command output: ${aliasCommand.stdOut}`);
}

async function resetToVanilla() {
    try {
        // Restore original executable in EAC Settings.json
        let settingsContent = await Neutralino.filesystem.readFile(EACSettingsFilePath);
        let settings = JSON.parse(settingsContent);
        settings.executable = 'bin\\win_x64\\HuntGame.exe';

        await Neutralino.filesystem.writeFile(EACSettingsFilePath, JSON.stringify(settings, null, 4));

        console.log('Reset to vanilla successfully!');
    } catch (error) {
        console.error('Error resetting to vanilla:', error);
    }
}

// Copy file function
async function copyFile(source, destination) {
    try {

        await Neutralino.filesystem.copy(source, destination);
        console.log(`File copied from ${source} to ${destination}`);
    } catch (error) {
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








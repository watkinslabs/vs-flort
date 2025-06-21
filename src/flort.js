const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const { FlortConfigProvider } = require('./config_provider');
const { register_flort_commands, save_current_settings_to_profile, load_profile_settings } = require('./command');

let is_initialized = false;
let initialization_promise = null;
let debug_output_channel = null;

function activate(context) {
    // Create debug output channel once
    debug_output_channel = vscode.window.createOutputChannel('Flort Debug');
    
    const flort_config_provider = new FlortConfigProvider();
    vscode.window.registerTreeDataProvider('flort-config-view', flort_config_provider);

    // Initialize extension asynchronously
    initialization_promise = initialize_extension(context, flort_config_provider);

    // Register commands immediately but ensure they wait for initialization
    register_flort_commands(context, flort_config_provider);
    register_profile_menu_commands(context);

    // Main flort command - uses current profile
    const flort_command = vscode.commands.registerCommand('flort.concatenate', async (...args) => {
        await ensure_initialized();
        await run_flort_command(args);
    });

    // Alternative command for profile selection
    const flort_with_profile_command = vscode.commands.registerCommand('flort.concatenateWithProfile', async (...args) => {
        await ensure_initialized();
        
        const config = vscode.workspace.getConfiguration('flort');
        const profiles = config.get('profiles', {});
        const profile_names = Object.keys(profiles);

        if (profile_names.length === 0) {
            // No profiles, create them first
            await initialize_default_profiles();
            // Refresh and try again
            const updated_profiles = config.get('profiles', {});
            const updated_profile_names = Object.keys(updated_profiles);
            
            if (updated_profile_names.length === 0) {
                vscode.window.showErrorMessage('Failed to initialize profiles. Please reload the extension.');
                return;
            }
        }

        if (profile_names.length === 1) {
            // Only one profile, use it
            const profile_name = profile_names[0];
            const original_profile = config.get('currentProfile', '');

            // Save current settings if there's an active profile
            if (original_profile) {
                await save_current_settings_to_profile(original_profile);
            }

            // Load and set the profile
            await load_profile_settings(profile_name);
            await config.update('currentProfile', profile_name, vscode.ConfigurationTarget.Workspace);

            try {
                await run_flort_command(args);
            } finally {
                // Restore original profile if there was one
                if (original_profile && original_profile !== profile_name) {
                    await load_profile_settings(original_profile);
                    await config.update('currentProfile', original_profile, vscode.ConfigurationTarget.Workspace);
                }
            }
            return;
        }

        // Multiple profiles - show dropdown popup
        const current_profile = config.get('currentProfile', '');
        const profile_items = profile_names.map(name => ({
            label: name,
            description: name === current_profile ? '(current)' : '',
            detail: `Run flort with ${name} profile`
        }));

        const selected = await vscode.window.showQuickPick(profile_items, {
            placeHolder: 'Choose profile to run flort with...',
            canPickMany: false,
            ignoreFocusOut: false,
            matchOnDescription: false,
            matchOnDetail: false
        });

        if (selected) {
            const original_profile = current_profile;

            // Save current settings to current profile before switching
            if (original_profile) {
                await save_current_settings_to_profile(original_profile);
            }

            // Load selected profile
            await load_profile_settings(selected.label);
            await config.update('currentProfile', selected.label, vscode.ConfigurationTarget.Workspace);

            try {
                await run_flort_command(args);
            } finally {
                // Restore original profile
                if (original_profile && original_profile !== selected.label) {
                    await load_profile_settings(original_profile);
                    await config.update('currentProfile', original_profile, vscode.ConfigurationTarget.Workspace);
                }
            }
        }
    });

    context.subscriptions.push(flort_command);
    context.subscriptions.push(flort_with_profile_command);
    context.subscriptions.push(debug_output_channel);
}

async function initialize_extension(context, flort_config_provider) {
    try {
        // Initialize default profiles first
        await initialize_default_profiles();
        
        // Wait a bit to ensure config is fully loaded
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if flort is available
        const flort_available = await check_flort_availability(true);
        
        if (!flort_available) {
            // Prompt for installation
            const install_choice = await vscode.window.showInformationMessage(
                'Flort is required for this extension to work. Would you like to install it now?',
                'Install Flort',
                'Install Later'
            );
            
            if (install_choice === 'Install Flort') {
                await install_flort();
            }
        }
        
        is_initialized = true;
        
        // Show welcome message on first install
        const global_state = context.globalState;
        const has_shown_welcome = global_state.get('flort.hasShownWelcome', false);
        
        if (!has_shown_welcome) {
            await global_state.update('flort.hasShownWelcome', true);
            
            const message = flort_available 
                ? 'Flort extension is ready! Right-click files or folders to concatenate them.'
                : 'Flort extension loaded. Install Flort to start using it: pip install flort';
                
            vscode.window.showInformationMessage(
                message,
                'View Profiles',
                'Open Documentation'
            ).then(choice => {
                if (choice === 'View Profiles') {
                    vscode.commands.executeCommand('workbench.view.extension.flort-sidebar');
                } else if (choice === 'Open Documentation') {
                    vscode.env.openExternal(vscode.Uri.parse('https://pypi.org/project/flort/'));
                }
            });
        }
        
        // Refresh the config provider after initialization
        flort_config_provider.refresh();
        
    } catch (error) {
        console.error('Failed to initialize flort extension:', error);
        vscode.window.showErrorMessage(`Failed to initialize flort extension: ${error.message}`);
        is_initialized = true; // Set to true even on error to prevent hanging
    }
}

async function ensure_initialized() {
    if (!is_initialized && initialization_promise) {
        await initialization_promise;
    }
}

async function install_flort() {
    return new Promise((resolve, reject) => {
        // First check if Python is available
        exec('python --version || python3 --version', async (error) => {
            if (error) {
                const choice = await vscode.window.showErrorMessage(
                    'Python is not found in PATH. Please install Python first.',
                    'Download Python',
                    'Close'
                );
                
                if (choice === 'Download Python') {
                    vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
                }
                resolve(false);
                return;
            }
            
            // Show progress notification
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Installing Flort",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Installing flort package..." });
                
                // Try to install using pip
                const terminal = vscode.window.createTerminal({
                    name: 'Flort Installation',
                    hideFromUser: false
                });
                
                terminal.show();
                
                // Determine the correct Python command
                const python_cmd = await get_python_command();
                
                // Install flort
                terminal.sendText(`${python_cmd} -m pip install --upgrade flort`);
                
                // Wait a moment for the command to start
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check if installation was successful (with a delay)
                setTimeout(async () => {
                    const is_installed = await check_flort_availability(false);
                    
                    if (is_installed) {
                        vscode.window.showInformationMessage(
                            'Flort installed successfully! You can now use the extension.',
                            'Get Started'
                        ).then(choice => {
                            if (choice === 'Get Started') {
                                vscode.commands.executeCommand('workbench.view.extension.flort-sidebar');
                            }
                        });
                        resolve(true);
                    } else {
                        vscode.window.showWarningMessage(
                            'Flort installation may have failed. Please check the terminal output and try again.',
                            'View Terminal'
                        ).then(choice => {
                            if (choice === 'View Terminal') {
                                terminal.show();
                            }
                        });
                        resolve(false);
                    }
                }, 10000); // Wait 10 seconds for installation
            });
        });
    });
}

async function get_python_command() {
    return new Promise((resolve) => {
        exec('python --version', (error) => {
            if (!error) {
                resolve('python');
            } else {
                exec('python3 --version', (error) => {
                    if (!error) {
                        resolve('python3');
                    } else {
                        resolve('python'); // Default fallback
                    }
                });
            }
        });
    });
}

async function check_flort_availability(silent = false) {
    return new Promise((resolve) => {
        exec('flort --version', (error) => {
            if (error) {
                if (!silent) {
                    const selection = vscode.window.showErrorMessage(
                        'Flort command not found. Please install the Python package: pip install flort',
                        'Install Now',
                        'View Instructions',
                        'Open Terminal'
                    ).then(choice => {
                        if (choice === 'Install Now') {
                            install_flort();
                        } else if (choice === 'View Instructions') {
                            vscode.env.openExternal(vscode.Uri.parse('https://pypi.org/project/flort/'));
                        } else if (choice === 'Open Terminal') {
                            vscode.commands.executeCommand('workbench.action.terminal.new');
                        }
                    });
                }
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

async function run_flort_command(args) {
    try {
        // Check if flort is available before proceeding
        const flort_available = await check_flort_availability();
        if (!flort_available) {
            return;
        }

        const config = vscode.workspace.getConfiguration('flort');
        const debug_enabled = config.get('debug', false);
        const current_profile = config.get('currentProfile', '');

        // Clear debug output channel if debug is enabled
        if (debug_enabled && debug_output_channel) {
            debug_output_channel.clear();
        }

        // Check if we have profiles and a current profile
        const profiles = config.get('profiles', {});
        if (Object.keys(profiles).length === 0) {
            vscode.window.showErrorMessage(
                'No profiles found. Initializing default profiles...',
                'OK'
            );
            await initialize_default_profiles();
            await new Promise(resolve => setTimeout(resolve, 1000));
            return;
        }

        if (!current_profile) {
            // No current profile set, use first available or prompt
            const profile_names = Object.keys(profiles);
            if (profile_names.length > 0) {
                const first_profile = profile_names[0];
                await config.update('currentProfile', first_profile, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage(`No profile was selected. Using "${first_profile}" profile.`);
            } else {
                vscode.window.showErrorMessage('No profiles available. Please create a profile first.');
                return;
            }
        }

        // collect selections
        let selected_items = [];

        if (debug_enabled && debug_output_channel) {
            debug_output_channel.appendLine(`=== ARGS DEBUG ===`);
            debug_output_channel.appendLine(`Current Profile: ${current_profile}`);
            debug_output_channel.appendLine(`args.length: ${args.length}`);
            for (let i = 0; i < args.length; i++) {
                debug_output_channel.appendLine(`args[${i}]: ${JSON.stringify(args[i])}`);
                if (args[i] && args[i].fsPath) {
                    debug_output_channel.appendLine(`  fsPath: ${args[i].fsPath}`);
                }
            }
            debug_output_channel.appendLine(`=== END ARGS DEBUG ===`);
        }

        if (args.length > 1 && Array.isArray(args[1])) {
            selected_items = args[1];
            if (debug_enabled && debug_output_channel) {
                debug_output_channel.appendLine(`Using args[1] array with ${selected_items.length} items`);
            }
        } else if (args.length > 0 && args[0]) {
            selected_items = [args[0]];
            if (debug_enabled && debug_output_channel) {
                debug_output_channel.appendLine(`Using args[0] as single item`);
            }
        } else {
            const active_editor = vscode.window.activeTextEditor;
            if (active_editor) {
                selected_items = [active_editor.document.uri];
                if (debug_enabled && debug_output_channel) {
                    debug_output_channel.appendLine(`Using active editor file`);
                }
            }
        }

        // split files / dirs
        const files = [];
        const dirs = [];

        if (debug_enabled && debug_output_channel) {
            debug_output_channel.appendLine(`=== PROCESSING ${selected_items.length} SELECTED ITEMS ===`);
        }

        for (const item of selected_items) {
            const fs_path = item.fsPath;
            if (debug_enabled && debug_output_channel) {
                debug_output_channel.appendLine(`Processing: ${fs_path}`);
            }
            try {
                const stat = await vscode.workspace.fs.stat(item);
                if (stat.type === vscode.FileType.Directory) {
                    dirs.push(`"${fs_path}"`);
                    if (debug_enabled && debug_output_channel) {
                        debug_output_channel.appendLine(`  -> Added as directory`);
                    }
                } else {
                    files.push(`"${fs_path}"`);
                    if (debug_enabled && debug_output_channel) {
                        debug_output_channel.appendLine(`  -> Added as file`);
                    }
                }
            } catch (err) {
                if (debug_enabled && debug_output_channel) {
                    debug_output_channel.appendLine(`ERROR: Failed to stat ${fs_path}: ${err.message}`);
                }
            }
        }

        if (debug_enabled && debug_output_channel) {
            debug_output_channel.appendLine(`=== RESULTS ===`);
            debug_output_channel.appendLine(`Files (${files.length}): ${files.join(', ')}`);
            debug_output_channel.appendLine(`Dirs (${dirs.length}): ${dirs.join(', ')}`);
        }

        if (files.length === 0 && dirs.length === 0 && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const directory_scan_optional = config.get('directoryScanOptional', false);

            if (debug_enabled && debug_output_channel) {
                debug_output_channel.appendLine(`No files or directories selected. Profile: ${current_profile}, directoryScanOptional: ${directory_scan_optional}`);
            }

            if (directory_scan_optional) {
                if (debug_enabled && debug_output_channel) {
                    debug_output_channel.appendLine('Directory scan optional enabled - not adding project base directory');
                }
                
                // For Cherry Pick profile, show a message and return early if no files selected
                if (current_profile === 'Cherry Pick') {
                    vscode.window.showInformationMessage(
                        'Cherry Pick profile requires manual file selection. Please select files first.',
                        'Select Files',
                        'Switch Profile'
                    ).then(choice => {
                        if (choice === 'Switch Profile') {
                            vscode.commands.executeCommand('flort.concatenateWithProfile');
                        }
                    });
                    if (debug_enabled && debug_output_channel) {
                        debug_output_channel.appendLine('Cherry Pick profile - no files selected, stopping execution');
                        debug_output_channel.show();
                    }
                    return;
                }
                // For other profiles with directoryScanOptional=true, just continue without adding base dir
                if (debug_enabled && debug_output_channel) {
                    debug_output_channel.appendLine('No base directory added due to directoryScanOptional setting');
                }
            } else {
                const project_base = vscode.workspace.workspaceFolders[0].uri.fsPath;
                dirs.push(`"${project_base}"`);

                if (debug_enabled && debug_output_channel) {
                    debug_output_channel.appendLine(`Adding project base directory: ${project_base}`);
                }
            }
        }
        
        // get current configuration (will use active profile settings)
        const patterns = config.get('patterns', []);
        const extensions = config.get('extensions', []);
        const manual_files = config.get('manualFiles', []);
        const exclude_patterns = config.get('excludePatterns', []);
        const exclude_extensions = config.get('excludeExtensions', []);
        const ignore_dirs = config.get('ignoreDirs', []);

        // For Cherry Pick profile: only use patterns/extensions if we have directories to scan
        // If we only have specific files, don't use patterns as they cause directory scanning
        const use_patterns = !(current_profile === 'Cherry Pick' && files.length > 0 && dirs.length === 0);
        const use_extensions = !(current_profile === 'Cherry Pick' && files.length > 0 && dirs.length === 0);

        if (debug_enabled && debug_output_channel) {
            debug_output_channel.appendLine(`Cherry Pick logic: use_patterns=${use_patterns}, use_extensions=${use_extensions}`);
            debug_output_channel.appendLine(`Reason: profile=${current_profile}, files.length=${files.length}, dirs.length=${dirs.length}`);
        }

        // format manual files
        const formatted_manual_files = manual_files.map(f => `"${f}"`);

        // build args - conditionally use patterns/extensions
        const patterns_arg = (use_patterns && patterns.length > 0) ? `-g ${patterns.map(p => `'${p}'`).join(',')}` : '';
        const extensions_arg = (use_extensions && extensions.length > 0) ? `-e ${extensions.map(e => e.startsWith('.') ? e.substring(1) : e).join(',')}` : '';
        const exclude_patterns_arg = exclude_patterns.length > 0 ? `--exclude-patterns ${exclude_patterns.map(p => `'${p}'`).join(',')}` : '';
        const exclude_extensions_arg = exclude_extensions.length > 0 ? `--exclude-extensions ${exclude_extensions.map(e => e.startsWith('.') ? e.substring(1) : e).join(',')}` : '';
        const ignore_dirs_arg = ignore_dirs.length > 0 ? `--ignore-dirs ${ignore_dirs.join(',')}` : '';

        // behavior flags
        const flags = [];
        if (config.get('all', false)) flags.push('--all');
        if (config.get('hidden', false)) flags.push('--hidden');
        if (config.get('includeBinary', false)) flags.push('--include-binary');
        const max_depth = config.get('maxDepth', 0);
        if (max_depth > 0) flags.push(`--max-depth ${max_depth}`);

        // output control
        if (config.get('showConfig', false)) flags.push('--show-config');
        if (config.get('noTree', false)) flags.push('--no-tree');
        if (config.get('outline', false)) flags.push('--outline');
        if (config.get('manifest', false)) flags.push('--manifest');
        if (config.get('noDump', false)) flags.push('--no-dump');
        const archive = config.get('archive', '').trim();
        if (archive) flags.push(`--archive ${archive}`);
        if (config.get('verbose', false)) flags.push('--verbose');

        // build full command
        const files_arg = files.concat(formatted_manual_files).join(',');
        const dirs_arg = dirs.join(' ');

        const parts = [
            'flort',
            files_arg ? `-f ${files_arg}` : '',
            patterns_arg,
            extensions_arg,
            exclude_patterns_arg,
            exclude_extensions_arg,
            ignore_dirs_arg,
            ...flags,
            dirs_arg,
            '-o stdio'
        ];

        const full_command = parts.filter(p => p && p.trim() !== '').join(' ');

        // debug log
        if (debug_enabled && debug_output_channel) {
            debug_output_channel.appendLine(`Selected files: ${files_arg}`);
            debug_output_channel.appendLine(`Selected dirs: ${dirs_arg}`);
            debug_output_channel.appendLine(`Patterns: ${patterns_arg}`);
            debug_output_channel.appendLine(`Extensions: ${extensions_arg}`);
            debug_output_channel.appendLine(`Exclude Patterns: ${exclude_patterns_arg}`);
            debug_output_channel.appendLine(`Exclude Extensions: ${exclude_extensions_arg}`);
            debug_output_channel.appendLine(`Ignore Dirs: ${ignore_dirs_arg}`);
            debug_output_channel.appendLine(`Flags: ${flags.join(' ')}`);
            debug_output_channel.appendLine(`Full command: ${full_command}`);
            debug_output_channel.show();
        }

        // run flort
        return new Promise((resolve, reject) => {
            exec(full_command, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                maxBuffer: 1024 * 1024 * 10
            }, async (error, stdout, stderr) => {
                if (error) {
                    // Enhanced error handling for common issues
                    let error_message = `Flort failed: ${error.message}`;
                    let show_instructions = false;

                    if (error.message.includes('command not found') || error.message.includes('not recognized')) {
                        error_message = 'Flort command not found. Please install: pip install flort';
                        show_instructions = true;
                    } else if (error.message.includes('python') || error.message.includes('pip')) {
                        error_message = 'Python/pip not available. Please ensure Python is installed and in PATH.';
                        show_instructions = true;
                    }

                    if (show_instructions) {
                        vscode.window.showErrorMessage(
                            error_message,
                            'Install Now',
                            'View Instructions',
                            'Open Terminal'
                        ).then(choice => {
                            if (choice === 'Install Now') {
                                install_flort();
                            } else if (choice === 'View Instructions') {
                                vscode.env.openExternal(vscode.Uri.parse('https://pypi.org/project/flort/'));
                            } else if (choice === 'Open Terminal') {
                                vscode.commands.executeCommand('workbench.action.terminal.new');
                            }
                        });
                    } else {
                        vscode.window.showErrorMessage(error_message);
                    }

                    if (debug_enabled && debug_output_channel) {
                        debug_output_channel.appendLine(`ERROR: ${error.message}`);
                        debug_output_channel.show();
                    }
                    reject(error);
                    return;
                }

                if (stderr && stderr.trim() !== '') {
                    vscode.window.showWarningMessage(`Flort warning: ${stderr}`);
                }

                try {
                    const document = await vscode.workspace.openTextDocument({
                        content: stdout,
                        language: 'text'
                    });

                    // Open document and bring it into focus
                    await vscode.window.showTextDocument(document);
                    resolve();
                } catch (doc_error) {
                    vscode.window.showErrorMessage(`Failed to open result: ${doc_error.message}`);
                    reject(doc_error);
                }
            });
        });

    } catch (err) {
        vscode.window.showErrorMessage(`Flort extension error: ${err.message}`);
    }
}

function register_profile_menu_commands(context) {
    const profile_commands = [
        { command: 'flort.runWithCherryPick', profile: 'Cherry Pick' },
        { command: 'flort.runWithAllFiles', profile: 'All Files' },
        { command: 'flort.runWithPython', profile: 'Python' },
        { command: 'flort.runWithJavaScript', profile: 'JavaScript' },
        { command: 'flort.runWithC', profile: 'C' },
        { command: 'flort.runWithCPlusPlus', profile: 'C++' },
        { command: 'flort.runWithPHP', profile: 'PHP' },
        { command: 'flort.runWithMarkdown', profile: 'Markdown' }
    ];

    profile_commands.forEach(({ command, profile }) => {
        const disposable = vscode.commands.registerCommand(command, async (...args) => {
            await ensure_initialized();
            await run_flort_with_profile(profile, args);
        });
        context.subscriptions.push(disposable);
    });
}

async function run_flort_with_profile(profile_name, args) {
    const config = vscode.workspace.getConfiguration('flort');
    const profiles = config.get('profiles', {});

    // Check if profile exists
    if (!profiles[profile_name]) {
        vscode.window.showErrorMessage(`Profile "${profile_name}" not found. Initializing profiles...`);
        await initialize_default_profiles();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try again
        const updated_profiles = config.get('profiles', {});
        if (!updated_profiles[profile_name]) {
            vscode.window.showErrorMessage(`Profile "${profile_name}" still not found after initialization.`);
            return;
        }
    }

    const original_profile = config.get('currentProfile', '');

    // Save current settings if there's an active profile
    if (original_profile) {
        await save_current_settings_to_profile(original_profile);
    }

    try {
        // Load selected profile
        await load_profile_settings(profile_name);
        await config.update('currentProfile', profile_name, vscode.ConfigurationTarget.Workspace);

        // Run flort with the profile
        await run_flort_command(args);
    } finally {
        // Restore original profile
        if (original_profile && original_profile !== profile_name) {
            await load_profile_settings(original_profile);
            await config.update('currentProfile', original_profile, vscode.ConfigurationTarget.Workspace);
        }
    }
}

async function initialize_default_profiles() {
    const config = vscode.workspace.getConfiguration('flort');
    const existing_profiles = config.get('profiles', {});

    console.log('Current profiles:', existing_profiles);

    // Only create defaults if no profiles exist
    if (Object.keys(existing_profiles).length === 0) {
        console.log('No profiles found, creating defaults...');
        const default_profiles = {
            "Cherry Pick": {
                "patterns": ["*.*"],
                "extensions": [],
                "excludePatterns": [],
                "excludeExtensions": [],
                "ignoreDirs": [],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": false,
                "all": false,
                "includeBinary": false,
                "noTree": false,
                "outline": false,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": true
            },
            "All Files": {
                "patterns": ["*.*"],
                "extensions": [],
                "excludePatterns": ["*.log", "*.tmp"],
                "excludeExtensions": ["log", "tmp", "cache"],
                "ignoreDirs": ["node_modules", "__pycache__", ".git", ".svn", "vendor", "build", "dist"],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": true,
                "all": true,
                "includeBinary": false,
                "noTree": false,
                "outline": false,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": false
            },
            "Python": {
                "patterns": [],
                "extensions": ["py"],
                "excludePatterns": ["__pycache__/*", "*.pyc"],
                "excludeExtensions": ["pyc", "pyo"],
                "ignoreDirs": ["__pycache__", ".pytest_cache", "venv", ".venv", "env", ".env"],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": false,
                "all": false,
                "includeBinary": false,
                "noTree": false,
                "outline": true,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": false
            },
            "JavaScript": {
                "patterns": [],
                "extensions": ["js", "ts", "jsx", "tsx", "json"],
                "excludePatterns": ["node_modules/*", "dist/*", "build/*"],
                "excludeExtensions": ["min.js", "bundle.js"],
                "ignoreDirs": ["node_modules", "dist", "build", ".next", "coverage"],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": false,
                "all": false,
                "includeBinary": false,
                "noTree": false,
                "outline": false,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": false
            },
            "C": {
                "patterns": [],
                "extensions": ["c", "h"],
                "excludePatterns": ["*.o", "*.obj", "*.exe"],
                "excludeExtensions": ["o", "obj", "exe", "dll", "so"],
                "ignoreDirs": ["build", "Debug", "Release", ".vs"],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": false,
                "all": false,
                "includeBinary": false,
                "noTree": false,
                "outline": false,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": false
            },
            "C++": {
                "patterns": [],
                "extensions": ["cpp", "cc", "cxx", "hpp", "h", "hxx"],
                "excludePatterns": ["*.o", "*.obj", "*.exe"],
                "excludeExtensions": ["o", "obj", "exe", "dll", "so"],
                "ignoreDirs": ["build", "Debug", "Release", ".vs", "cmake-build-debug", "cmake-build-release"],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": false,
                "all": false,
                "includeBinary": false,
                "noTree": false,
                "outline": false,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": false
            },
            "PHP": {
                "patterns": [],
                "extensions": ["php", "phtml", "php3", "php4", "php5"],
                "excludePatterns": ["vendor/*", "cache/*"],
                "excludeExtensions": [],
                "ignoreDirs": ["vendor", "cache", "storage/cache", "bootstrap/cache"],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": false,
                "all": false,
                "includeBinary": false,
                "noTree": false,
                "outline": false,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": false
            },
            "Markdown": {
                "patterns": [],
                "extensions": ["md", "markdown", "mdown", "mkd"],
                "excludePatterns": [],
                "excludeExtensions": [],
                "ignoreDirs": [],
                "manualFiles": [],
                "debug": false,
                "showConfig": false,
                "hidden": false,
                "all": false,
                "includeBinary": false,
                "noTree": true,
                "outline": false,
                "manifest": false,
                "noDump": false,
                "verbose": false,
                "maxDepth": 0,
                "archive": "",
                "directoryScanOptional": false
            }
        };

        try {
            await config.update('profiles', default_profiles, vscode.ConfigurationTarget.Workspace);
            
            // Set default profile to "All Files"
            await config.update('currentProfile', 'All Files', vscode.ConfigurationTarget.Workspace);
            
            console.log('Default profiles created successfully');
            
            // Wait a bit to ensure config is written
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh the tree view after creating profiles
            vscode.commands.executeCommand('flort.refreshProfiles');
        } catch (error) {
            console.error('Failed to initialize default Flort profiles:', error);
            throw error; // Re-throw to handle in caller
        }
    } else {
        console.log('Profiles already exist, skipping initialization');
        
        // Ensure there's a current profile set
        const current_profile = config.get('currentProfile', '');
        if (!current_profile && Object.keys(existing_profiles).length > 0) {
            // Set to first available profile
            const first_profile = Object.keys(existing_profiles)[0];
            await config.update('currentProfile', first_profile, vscode.ConfigurationTarget.Workspace);
            console.log(`Set current profile to: ${first_profile}`);
        }
    }
}

function deactivate() {
    if (debug_output_channel) {
        debug_output_channel.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};
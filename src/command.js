const vscode = require('vscode');

async function update_config_array(section, updater) {
    const config = vscode.workspace.getConfiguration('flort');
    const values = config.get(section, []);
    const new_values = updater(values);
    await config.update(section, new_values, vscode.ConfigurationTarget.Workspace);

    // Auto-save to current profile
    await save_current_settings_to_active_profile();
}

async function update_config_object(section, updater) {
    const config = vscode.workspace.getConfiguration('flort');
    const obj = config.get(section, {});
    const new_obj = updater(obj);
    await config.update(section, new_obj, vscode.ConfigurationTarget.Workspace);
}

async function load_profile_settings(profile_name) {
    const config = vscode.workspace.getConfiguration('flort');
    const profiles = config.get('profiles', {});

    if (!profiles[profile_name]) {
        throw new Error(`Profile "${profile_name}" not found`);
    }

    const profile = profiles[profile_name];

    // Load profile settings into active workspace configuration
    await config.update('patterns', profile.patterns || [], vscode.ConfigurationTarget.Workspace);
    await config.update('extensions', profile.extensions || [], vscode.ConfigurationTarget.Workspace);
    await config.update('manualFiles', profile.manualFiles || [], vscode.ConfigurationTarget.Workspace);
    await config.update('excludePatterns', profile.excludePatterns || [], vscode.ConfigurationTarget.Workspace);
    await config.update('excludeExtensions', profile.excludeExtensions || [], vscode.ConfigurationTarget.Workspace);
    await config.update('ignoreDirs', profile.ignoreDirs || [], vscode.ConfigurationTarget.Workspace);

    // Load other profile settings if they exist
    if (profile.debug !== undefined) await config.update('debug', profile.debug, vscode.ConfigurationTarget.Workspace);
    if (profile.showConfig !== undefined) await config.update('showConfig', profile.showConfig, vscode.ConfigurationTarget.Workspace);
    if (profile.hidden !== undefined) await config.update('hidden', profile.hidden, vscode.ConfigurationTarget.Workspace);
    if (profile.all !== undefined) await config.update('all', profile.all, vscode.ConfigurationTarget.Workspace);
    if (profile.includeBinary !== undefined) await config.update('includeBinary', profile.includeBinary, vscode.ConfigurationTarget.Workspace);
    if (profile.noTree !== undefined) await config.update('noTree', profile.noTree, vscode.ConfigurationTarget.Workspace);
    if (profile.outline !== undefined) await config.update('outline', profile.outline, vscode.ConfigurationTarget.Workspace);
    if (profile.manifest !== undefined) await config.update('manifest', profile.manifest, vscode.ConfigurationTarget.Workspace);
    if (profile.noDump !== undefined) await config.update('noDump', profile.noDump, vscode.ConfigurationTarget.Workspace);
    if (profile.verbose !== undefined) await config.update('verbose', profile.verbose, vscode.ConfigurationTarget.Workspace);
    if (profile.maxDepth !== undefined) await config.update('maxDepth', profile.maxDepth, vscode.ConfigurationTarget.Workspace);
    if (profile.archive !== undefined) await config.update('archive', profile.archive, vscode.ConfigurationTarget.Workspace);
    if (profile.directoryScanOptional !== undefined) await config.update('directoryScanOptional', profile.directoryScanOptional, vscode.ConfigurationTarget.Workspace);
}

async function save_current_settings_to_profile(profile_name) {
    const config = vscode.workspace.getConfiguration('flort');
    const profiles = config.get('profiles', {});

    // Capture ALL current settings
    const current_settings = {
        patterns: config.get('patterns', []),
        extensions: config.get('extensions', []),
        manualFiles: config.get('manualFiles', []),
        excludePatterns: config.get('excludePatterns', []),
        excludeExtensions: config.get('excludeExtensions', []),
        ignoreDirs: config.get('ignoreDirs', []),
        debug: config.get('debug', false),
        showConfig: config.get('showConfig', false),
        hidden: config.get('hidden', false),
        all: config.get('all', false),
        includeBinary: config.get('includeBinary', false),
        noTree: config.get('noTree', false),
        outline: config.get('outline', false),
        manifest: config.get('manifest', false),
        noDump: config.get('noDump', false),
        verbose: config.get('verbose', false),
        maxDepth: config.get('maxDepth', 0),
        archive: config.get('archive', ''),
        directoryScanOptional: config.get('directoryScanOptional', false)
    };

    profiles[profile_name] = current_settings;
    await config.update('profiles', profiles, vscode.ConfigurationTarget.Workspace);
}

async function save_current_settings_to_active_profile() {
    const config = vscode.workspace.getConfiguration('flort');
    const current_profile = config.get('currentProfile', '');

    if (current_profile) {
        await save_current_settings_to_profile(current_profile);
    }
}

function register_flort_commands(context, provider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('flort.addPattern', async () => {
            const value = await vscode.window.showInputBox({ prompt: 'Enter glob pattern (ex: *.txt)' });
            if (value) {
                const config = vscode.workspace.getConfiguration('flort');
                const current_patterns = config.get('patterns', []);
                if (!current_patterns.includes(value)) {
                    await update_config_array('patterns', arr => [...arr, value]);
                    setTimeout(() => provider.refresh(), 100);
                } else {
                    vscode.window.showWarningMessage(`Pattern "${value}" already exists`);
                }
            }
        }),

        vscode.commands.registerCommand('flort.removePattern', async (item) => {
            await update_config_array('patterns', arr => arr.filter(p => p !== item.label));
            setTimeout(() => provider.refresh(), 100);
        }),

        vscode.commands.registerCommand('flort.addExtension', async () => {
            const value = await vscode.window.showInputBox({ prompt: 'Enter extension (ex: .js)' });
            if (value) {
                const config = vscode.workspace.getConfiguration('flort');
                const current_extensions = config.get('extensions', []);
                if (!current_extensions.includes(value)) {
                    await update_config_array('extensions', arr => [...arr, value]);
                    setTimeout(() => provider.refresh(), 100);
                } else {
                    vscode.window.showWarningMessage(`Extension "${value}" already exists`);
                }
            }
        }),

        vscode.commands.registerCommand('flort.removeExtension', async (item) => {
            await update_config_array('extensions', arr => arr.filter(e => e !== item.label));
            setTimeout(() => provider.refresh(), 100);
        }),

        vscode.commands.registerCommand('flort.addManualFile', async () => {
            const uri = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectMany: false });
            if (uri && uri.length > 0) {
                const path = uri[0].fsPath;
                const config = vscode.workspace.getConfiguration('flort');
                const current_files = config.get('manualFiles', []);
                if (!current_files.includes(path)) {
                    await update_config_array('manualFiles', arr => [...arr, path]);
                    setTimeout(() => provider.refresh(), 100);
                } else {
                    vscode.window.showWarningMessage(`File "${path}" already exists`);
                }
            }
        }),

        vscode.commands.registerCommand('flort.removeManualFile', async (item) => {
            await update_config_array('manualFiles', arr => arr.filter(f => f !== item.label));
            setTimeout(() => provider.refresh(), 100);
        }),

        vscode.commands.registerCommand('flort.setProfile', async (item) => {
            const profile_name = item.label.replace(' (active)', '');
            const config = vscode.workspace.getConfiguration('flort');
            const current_profile = config.get('currentProfile', '');

            // Save current settings to the currently active profile before switching
            if (current_profile && current_profile !== profile_name) {
                await save_current_settings_to_profile(current_profile);
            }

            try {
                // Load the selected profile settings
                await load_profile_settings(profile_name);

                // Set as current profile
                await config.update('currentProfile', profile_name, vscode.ConfigurationTarget.Workspace);

                setTimeout(() => provider.refresh(), 100);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to switch to profile: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('flort.addProfile', async () => {
            const profile_name = await vscode.window.showInputBox({ prompt: 'Enter profile name' });
            if (profile_name) {
                const config = vscode.workspace.getConfiguration('flort');
                const current_profiles = config.get('profiles', {});
                if (!current_profiles[profile_name]) {
                    // Save current settings as the new profile
                    await save_current_settings_to_profile(profile_name);
                    await config.update('currentProfile', profile_name, vscode.ConfigurationTarget.Workspace);
                    setTimeout(() => provider.refresh(), 100);
                } else {
                    vscode.window.showWarningMessage(`Profile "${profile_name}" already exists`);
                }
            }
        }),

        vscode.commands.registerCommand('flort.toggleSetting', async (item) => {
            if (!item || !item.settingKey) {
                vscode.window.showErrorMessage('Invalid setting item');
                return;
            }
            const setting_key = item.settingKey;
            const config = vscode.workspace.getConfiguration('flort');
            const current = config.get(setting_key, false);
            await config.update(setting_key, !current, vscode.ConfigurationTarget.Workspace);

            // Auto-save to current profile
            await save_current_settings_to_active_profile();
            setTimeout(() => provider.refresh(), 100);
        }),

        vscode.commands.registerCommand('flort.editSetting', async (item) => {
            if (!item || !item.settingKey) {
                vscode.window.showErrorMessage('Invalid setting item');
                return;
            }
            const setting_key = item.settingKey;
            const config = vscode.workspace.getConfiguration('flort');
            const current = config.get(setting_key, '');
            const value = await vscode.window.showInputBox({
                prompt: `Enter value for ${setting_key}`,
                value: String(current)
            });
            if (value !== undefined) {
                const parsed = isNaN(value) ? value : Number(value);
                await config.update(setting_key, parsed, vscode.ConfigurationTarget.Workspace);

                // Auto-save to current profile
                await save_current_settings_to_active_profile();
                setTimeout(() => provider.refresh(), 100);
            }
        }),

        // New commands for exclude patterns, extensions, and exclude dirs
        vscode.commands.registerCommand('flort.addExcludePattern', async () => {
            const value = await vscode.window.showInputBox({ prompt: 'Enter exclude pattern (ex: *.tmp)' });
            if (value) {
                const config = vscode.workspace.getConfiguration('flort');
                const current_patterns = config.get('excludePatterns', []);
                if (!current_patterns.includes(value)) {
                    await update_config_array('excludePatterns', arr => [...arr, value]);
                    setTimeout(() => provider.refresh(), 100);
                } else {
                    vscode.window.showWarningMessage(`Exclude pattern "${value}" already exists`);
                }
            }
        }),

        vscode.commands.registerCommand('flort.removeExcludePattern', async (item) => {
            await update_config_array('excludePatterns', arr => arr.filter(p => p !== item.label));
            setTimeout(() => provider.refresh(), 100);
        }),

        vscode.commands.registerCommand('flort.addExcludeExtension', async () => {
            const value = await vscode.window.showInputBox({ prompt: 'Enter exclude extension (ex: .tmp)' });
            if (value) {
                const config = vscode.workspace.getConfiguration('flort');
                const current_extensions = config.get('excludeExtensions', []);
                if (!current_extensions.includes(value)) {
                    await update_config_array('excludeExtensions', arr => [...arr, value]);
                    setTimeout(() => provider.refresh(), 100);
                } else {
                    vscode.window.showWarningMessage(`Exclude extension "${value}" already exists`);
                }
            }
        }),

        vscode.commands.registerCommand('flort.removeExcludeExtension', async (item) => {
            await update_config_array('excludeExtensions', arr => arr.filter(e => e !== item.label));
            setTimeout(() => provider.refresh(), 100);
        }),

        vscode.commands.registerCommand('flort.addExcludeDir', async () => {
            const value = await vscode.window.showInputBox({ prompt: 'Enter directory to exclude (ex: node_modules)' });
            if (value) {
                const config = vscode.workspace.getConfiguration('flort');
                const current_dirs = config.get('ignoreDirs', []);
                if (!current_dirs.includes(value)) {
                    await update_config_array('ignoreDirs', arr => [...arr, value]);
                    setTimeout(() => provider.refresh(), 100);
                } else {
                    vscode.window.showWarningMessage(`Exclude directory "${value}" already exists`);
                }
            }
        }),

        vscode.commands.registerCommand('flort.removeExcludeDir', async (item) => {
            await update_config_array('ignoreDirs', arr => arr.filter(d => d !== item.label));
            setTimeout(() => provider.refresh(), 100);
        }),

        // Simplified list commands that were causing issues
        vscode.commands.registerCommand('flort.addToListSetting', async (setting_key) => {
            const value = await vscode.window.showInputBox({ prompt: `Enter value for ${setting_key}` });
            if (value) {
                update_config_array(setting_key, arr => [...arr, value]);
                provider.refresh();
            }
        }),

        vscode.commands.registerCommand('flort.removeFromListSetting', async (item) => {
            const setting_key = item.settingKey;
            const value = item.label;
            update_config_array(setting_key, arr => arr.filter(v => v !== value));
            provider.refresh();
        }),

        // New commands for refresh and settings
        vscode.commands.registerCommand('flort.refreshProfiles', () => {
            provider.refresh();
        }),

        vscode.commands.registerCommand('flort.openWorkspaceSettings', async () => {
            await vscode.commands.executeCommand('workbench.action.openWorkspaceSettingsFile');
        })
    );
}

module.exports = {
    register_flort_commands,
    save_current_settings_to_profile,
    load_profile_settings
};
const vscode = require('vscode');

class FlortConfigProvider {
    constructor() {
        this._on_did_change_tree_data = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._on_did_change_tree_data.event;
    }

    async create_empty_profile(profile_name) {
        const config = vscode.workspace.getConfiguration('flort');
        const profiles = config.get('profiles', {});

        const empty_profile = {
            patterns: [],
            extensions: [],
            manualFiles: [],
            excludePatterns: [],
            excludeExtensions: [],
            ignoreDirs: [],
            showConfig: false,
            noTree: false,
            outline: false,
            manifest: false,
            noDump: false,
            archive: '',
            debug: false,
            verbose: false,
            all: false,
            hidden: false,
            includeBinary: false,
            maxDepth: 0,
            directoryScanOptional: false
        };

        profiles[profile_name] = empty_profile;
        await config.update('profiles', profiles, vscode.ConfigurationTarget.Workspace);
        this.refresh();
    }

    refresh() {
        this._on_did_change_tree_data.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        const config = vscode.workspace.getConfiguration('flort');

        if (!element) {
            return [
                this._create_section('Profiles', 'sectionProfiles'),
                this._create_separator(),
                this._create_section('File Selection', 'sectionFileSelection'),
                this._create_section('Filtering', 'sectionFiltering'),
                this._create_section('Output Options', 'sectionOutputOptions'),
                this._create_section('Advanced Settings', 'sectionAdvancedSettings')
            ];
        }

        switch (element.contextValue) {
            case 'sectionProfiles': {
                const profiles = config.get('profiles', {});
                const current_profile = config.get('currentProfile', '');
                const profile_items = Object.keys(profiles).map(name => {
                    const label = name === current_profile ? `${name} (active)` : name;
                    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                    item.contextValue = 'profile';
                    item.profileName = name;
                    item.iconPath = new vscode.ThemeIcon(name === current_profile ? 'star-full' : 'account');
                    item.command = {
                        command: 'flort.setProfile',
                        title: 'Activate Profile',
                        arguments: [{ label: name }]
                    };
                    return item;
                });
                return profile_items;
            }
            case 'sectionFileSelection': {
                return [
                    this._create_subsection('Patterns', 'sectionPatterns'),
                    this._create_subsection('Extensions', 'sectionExtensions'),
                    this._create_subsection('Manual Files', 'sectionManualFiles')
                ];
            }
            case 'sectionFiltering': {
                return [
                    this._create_subsection('Exclude Patterns', 'excludePatterns'),
                    this._create_subsection('Exclude Extensions', 'excludeExtensions'),
                    this._create_subsection('Exclude Directories', 'excludeDirs')
                ];
            }
            case 'sectionOutputOptions': {
                const config = vscode.workspace.getConfiguration('flort');
                return [
                    this._create_boolean_setting(config, 'showConfig', 'Show Config'),
                    this._create_boolean_setting(config, 'noTree', 'Skip Directory Tree'),
                    this._create_boolean_setting(config, 'outline', 'Generate Code Outline'),
                    this._create_boolean_setting(config, 'manifest', 'File Listing Only'),
                    this._create_boolean_setting(config, 'noDump', 'Skip File Content'),
                    this._create_string_setting(config, 'archive', 'Archive Type')
                ];
            }
            case 'sectionAdvancedSettings': {
                const config = vscode.workspace.getConfiguration('flort');
                return [
                    this._create_boolean_setting(config, 'debug', 'Debug Output'),
                    this._create_boolean_setting(config, 'verbose', 'Verbose Logging'),
                    this._create_boolean_setting(config, 'all', 'Include All Files'),
                    this._create_boolean_setting(config, 'hidden', 'Include Hidden Files'),
                    this._create_boolean_setting(config, 'includeBinary', 'Include Binary Files'),
                    this._create_boolean_setting(config, 'directoryScanOptional', 'Directory Scan Optional'),
                    this._create_number_setting(config, 'maxDepth', 'Max Directory Depth')
                ];
            }
            case 'sectionPatterns': {
                const patterns = config.get('patterns', []);
                return patterns.map(val => this._create_item(val, 'pattern'));
            }
            case 'sectionExtensions': {
                const extensions = config.get('extensions', []);
                return extensions.map(val => this._create_item(val, 'extension'));
            }
            case 'sectionManualFiles': {
                const manual_files = config.get('manualFiles', []);
                return manual_files.map(val => this._create_item(val, 'manualFile'));
            }
            case 'excludePatterns': {
                const exclude_patterns = config.get('excludePatterns', []);
                return exclude_patterns.map(val => this._create_item(val, 'excludePattern'));
            }
            case 'excludeExtensions': {
                const exclude_extensions = config.get('excludeExtensions', []);
                return exclude_extensions.map(val => this._create_item(val, 'excludeExtension'));
            }
            case 'excludeDirs': {
                const exclude_dirs = config.get('ignoreDirs', []);
                return exclude_dirs.map(val => this._create_item(val, 'excludeDir'));
            }
            default:
                return [];
        }
    }

    _create_section(label, section_context) {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = section_context;
        item.iconPath = new vscode.ThemeIcon('folder-opened');
        return item;
    }

    _create_subsection(label, section_context) {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        item.contextValue = section_context;
        item.iconPath = new vscode.ThemeIcon('list-unordered');
        return item;
    }

    _create_separator() {
        const item = new vscode.TreeItem('─────────────────', vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'separator';
        item.iconPath = new vscode.ThemeIcon('dash');
        return item;
    }

    _create_item(label, context_value) {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = context_value;
        item.iconPath = this._get_icon_for_context(context_value);
        return item;
    }

    _create_boolean_setting(config, key, label) {
        const value = config.get(key, false);
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'booleanSetting';
        item.settingKey = key;
        item.iconPath = new vscode.ThemeIcon(value ? 'toggle-on' : 'toggle-off');
        item.description = value ? 'On' : 'Off';
        return item;
    }

    _create_number_setting(config, key, label) {
        const value = config.get(key, 0);
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'numberSetting';
        item.settingKey = key;
        item.iconPath = new vscode.ThemeIcon('symbol-number');
        item.description = String(value);
        return item;
    }

    _create_string_setting(config, key, label) {
        const value = config.get(key, '');
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'stringSetting';
        item.settingKey = key;
        item.iconPath = new vscode.ThemeIcon('symbol-string');
        item.description = value || '(none)';
        return item;
    }

    _get_icon_for_context(context_value) {
        const icon_map = {
            pattern: 'search',
            extension: 'file-code',
            manualFile: 'file',
            excludePattern: 'exclude',
            excludeExtension: 'file-binary',
            excludeDir: 'folder'
        };
        return new vscode.ThemeIcon(icon_map[context_value] || 'circle');
    }
}

module.exports = { FlortConfigProvider };
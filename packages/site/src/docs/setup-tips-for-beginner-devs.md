## Setup Development Environment
1. Download and install Visual Studio Code (our preferred code editor).
2. Install Git from https://git-scm.com/downloads using the following instructions:<br/>
    a. Select Components - Defaults are fine<br/>
    b) Select Start Menu Folder - Defaults are fine<br/>
    c) Choosing the default editor used by Git: Select “Use Visual Studio as Git’s default editor”<br/>
    d) Adjusting your PATH environment: Select “Use Git from the Windows Command Prompt”<br/>
    e) Choosing the SSH executable: Use OpenSSH<br/>
    f) Choosing the HTTPS transport backend: Use the OpenSSL library<br/>
    g) Configuring the line ending conversions - Default is fine<br/>
    g) Configuring the terminal emulator to use with Git Bash: Select “Use MinTTY”<br/>
    i) Configuring extra options - Defaults are fine<br/>
    *At some point you may need to tell Git who you are (use github email and username).*
3. Open VS Code and pull the repository onto your computer:<br/>
    a) Type `Ctrl + Shift + p` to get VS Code ready to receive a command and enter `Git init` then select a folder where you would like to store the site.<br/>
    b) Type `Ctrl + Shift + p` again and enter `git: clone` followed by `https://github.com/jwrunner/talking-dictionaries` to pull down the code.
4. Install Node.js (includes NPM).
5. Next run `npm install` to install all the project's package dependencies and finish setting up your dev environment.
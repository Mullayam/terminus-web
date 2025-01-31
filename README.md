# Web-Based Terminal with SFTP Integration

This project is a **web-based terminal** developed using modern web technologies, providing a seamless SSH connection interface with SFTP file management capabilities. Below are the details of the features, technologies used, and how to use the platform effectively.

## **Technologies Used**

-   **Frontend**: ReactJS + Vite
-   **State Management**: Zustand
-   **Backend**: Express.js
-   **Communication**: Socket.IO
-   **Database**: Redis
-   **Programming Language**: TypeScript

----------

## **Getting Started**

### **Landing Page**

1.  Open the application.
2.  Switch to **dark mode** for a better viewing experience.
3.  Click on the **Get Started** button to begin.

### **SSH Web Terminal**

1.  Choose the **SSH Web Terminal** option from the menu.
2.  Fill in the following details:
    -   **Host Server**: Enter the server's IP address.
    -   **Username**: Enter your username.
    -   **Authentication Method**: Select your preferred method (password or private key).
    -   **Password**: Enter your password (if applicable).
3.  Check the **Server Connection** box to confirm.
4.  Click the **Connect** button to establish the connection.

You can optionally save your connection details by providing a local name.

----------

## **Using the Terminal**

-   Once connected, you can start typing your favorite commands in the terminal. The interface mirrors a standard terminal like Windows Command Prompt or Linux shell.
-   **Command Search**: Use the dropdown menu on the right to browse and search for existing commands.
-   **Audio Feedback**: When you type a command, you will hear sound effects for an engaging experience.
-   The command output is displayed in real time below the input.

----------

## **SFTP File Management**

### **Accessing the SFTP Interface**

1.  Navigate to the left menu and click on the **SFTP** option.
2.  This opens a new page displaying the file directory of your VPS server.

### **File and Folder Operations**

-   **Filter Hidden Files**: Use the dropdown menu to toggle hidden files.
-   **Right-Click Menu**:
    -   **Refresh**: Refresh the current directory.
    -   **Rename**: Rename files or folders.
    -   **Move**: Move files to a different location.
    -   **New File**: Create a new file.
    -   **New Folder**: Create a new folder.
-   **Download**: Download a specific file or folder (folders are downloaded as a ZIP).
-   **Upload**:
    -   Click the three dots to access the upload option.
    -   Drag and drop single or multiple files/folders directly into the working directory.

----------

## **Data Storage**

-   User credentials (password and private key) are securely stored in the browser's **IndexedDB**.
-   File upload and download support includes drag-and-drop functionality and multi-file operations.

----------

## **Key Features**

-   Web-based SSH terminal interface with real-time command execution.
-   SFTP integration for file management with advanced filtering and drag-and-drop support.
-   Audio feedback for command input.
-   User-friendly file operations (create, rename, move, upload, download).
-   Secure storage of sensitive credentials in the browser.

----------

## **How to Run the Project Locally**

1.  Clone the repository.
2.  Install dependencies using `npm install`.
3.  Start the development server:
    
    ```
    npm run dev
    
    ```
    
4.  Start the backend server (Express):
    
    ```
    npm run dev
    
    ```
    
5.  Ensure Redis is installed and running locally.
6.  Access the app in your browser at `http://localhost:5173`.

----------

## **Future Enhancements**

-   Add more authentication options (e.g., OAuth, ).
-   Implement advanced terminal features like session recording.
-   Introduce multi-tab support for managing multiple sessions.
-   Enhance the SFTP interface with more granular controls and user analytics.

----------

Thank you for exploring this project! Feedback and contributions are always welcome.
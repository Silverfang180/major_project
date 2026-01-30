export interface Version {
    id: string;
    date: string;
    author: string;
    status: "Production" | "Staging" | "Draft";
    cost: string;
    text: string;
    accuracy: string;
    db_id?: number; // Real database ID for API operations
}

export const MOCK_VERSIONS: Version[] = [
    {
        id: "v3.0",
        date: "2025-10-24",
        author: "You",
        status: "Production",
        cost: "$0.004",
        accuracy: "98.5%",
        text: "Act as a senior Python debugger. Analyze the code below for potential memory leaks and race conditions. Provide a corrected version with detailed comments explaining the fixes.",
    },
    {
        id: "v2.1",
        date: "2025-10-23",
        author: "Alice",
        status: "Staging",
        cost: "$0.002",
        accuracy: "92.0%",
        text: "Act as a Python debugger. Check the code for errors and fix them. explain your changes.",
    },
    {
        id: "v1.0",
        date: "2025-10-20",
        author: "Bob",
        status: "Draft",
        cost: "$0.001",
        accuracy: "85.0%",
        text: "Help me fix code.",
    },
];

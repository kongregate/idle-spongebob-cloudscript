
function evaluatePlayFabError(error) {
    if (!error) {
        return undefined;
    }

    if (error.apiErrorInfo) {
        return error;
    }

    throw error;
}

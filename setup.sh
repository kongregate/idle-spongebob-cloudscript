mkdir .git/hooks
cp .githooks/pre-commit .git/hooks/pre-commit
cp .githooks/post-commit .git/hooks/post-commit
chmod 777 .git/hooks/pre-commit
chmod 777 .git/hooks/post-commit


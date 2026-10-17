FROM python:3.12-alpine
WORKDIR /app
COPY app /app/app
COPY web /app/web
COPY openapi.json /app/openapi.json
USER 1000:1000
ENV REPORTS_DIR=/reports
EXPOSE 8799
CMD ["python", "/app/app/server.py"]

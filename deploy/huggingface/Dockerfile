# The same image CI builds and Render runs. Nothing is rebuilt here: a Space that
# pulls a prebuilt image wakes in seconds instead of compiling the harness for
# twenty minutes.
FROM ghcr.io/blunt4tnulb/massai:0775aeb65c542619960bfffdd32dde9341501097

# Spaces route traffic to one port; the image's own default is 10000.
ENV DSH_ALLOW_WILDCARD_HOST=1
EXPOSE 7860

CMD ["sh", "-c", "echo massai booting on 7860 && exec node apps/cli/lib/bin.js web --no-open --host 0.0.0.0 --port 7860"]

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from commodity_feed import fetch_live_prices
from news_ingestion import ingest_news_and_calculate_risk

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def start_scheduler():
    if not scheduler.running:
        # Run every 60 minutes
        scheduler.add_job(
            fetch_live_prices,
            trigger=IntervalTrigger(minutes=60),
            id='fetch_commodity_prices',
            name='Fetch live commodity prices hourly',
            replace_existing=True
        )

        # Run every 4 hours for news and risk scores
        scheduler.add_job(
            ingest_news_and_calculate_risk,
            trigger=IntervalTrigger(hours=4),
            id='fetch_news_calculate_risk',
            name='Fetch news and calculate risk scores every 4 hours',
            replace_existing=True
        )
        
        # Initial run on startup
        try:
            fetch_live_prices()
        except Exception as e:
            logger.error(f"Error fetching on startup: {e}")
            
        scheduler.start()
        logger.info("Commodity price scheduler started.")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Commodity price scheduler stopped.")
